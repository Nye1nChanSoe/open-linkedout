import type BetterSqlite3 from "better-sqlite3";

import type {
  CreateCampaignInputType,
  DBCampaignRowType,
  FindCampaignByIdParamsType,
  InsertCampaignParamsType,
  UpdateCampaignStatusParamsType,
} from "@/types/campaign.type.js";
import type { DatabaseConnectionType } from "@/types/database.type.js";

export class CampaignRepository {
  private readonly findByIdStatement: BetterSqlite3.Statement<
    [FindCampaignByIdParamsType],
    DBCampaignRowType
  >;

  private readonly listStatement: BetterSqlite3.Statement<
    [],
    DBCampaignRowType
  >;

  private readonly insertCampaignStatement: BetterSqlite3.Statement<
    [InsertCampaignParamsType]
  >;

  private readonly updateStatusStatement: BetterSqlite3.Statement<
    [UpdateCampaignStatusParamsType]
  >;

  constructor(private readonly database: DatabaseConnectionType) {
    this.findByIdStatement = database.prepare(
      `
      SELECT *
      FROM campaigns
      WHERE id = @id;
    `,
    );

    this.listStatement = database.prepare(
      `
      SELECT *
      FROM campaigns
      ORDER BY created_at DESC;
    `,
    );

    this.insertCampaignStatement = database.prepare(
      `
      INSERT INTO campaigns (
        name,
        keywords_json,
        locations_json,
        max_pages_per_combination,
        status,
        cancel_requested_at,
        created_at,
        started_at,
        completed_at,
        updated_at
      )
      VALUES (
        @name,
        @keywords_json,
        @locations_json,
        @max_pages_per_combination,
        @status,
        @cancel_requested_at,
        @created_at,
        @started_at,
        @completed_at,
        @updated_at
      );
    `,
    );

    this.updateStatusStatement = database.prepare(
      `
      UPDATE campaigns
      SET
        status = @status,
        cancel_requested_at = @cancel_requested_at,
        started_at = @started_at,
        completed_at = @completed_at,
        updated_at = @updated_at
      WHERE id = @id;
    `,
    );
  }

  /**
   * Finds a campaign by its database identifier.
   * @param id - Campaigns table identifier.
   * @returns Matching campaign, if present.
   */
  findById(id: number) {
    return this.findByIdStatement.get({ id });
  }

  /**
   * Lists every campaign, newest first.
   * @returns All campaign rows.
   */
  list() {
    return this.listStatement.all();
  }

  /**
   * Creates one pending campaign.
   * @param input - Keywords, locations and per-combination page limit.
   * @returns Newly created campaign.
   */
  createCampaign(input: CreateCampaignInputType): DBCampaignRowType {
    const timestamp = new Date().toISOString();

    const result = this.insertCampaignStatement.run({
      name: input.name,
      keywords_json: JSON.stringify(input.keywords),
      locations_json: JSON.stringify(input.locations),
      max_pages_per_combination: input.maxPagesPerCombination,
      status: "pending",
      cancel_requested_at: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
    });

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Marks a campaign as started, keeping the first start time.
   * @param id - Campaigns table identifier.
   * @returns Updated campaign.
   */
  markRunning(id: number): DBCampaignRowType {
    const campaign = this.requireCampaign(id);
    const timestamp = new Date().toISOString();

    return this.applyStatus(campaign, {
      status: "running",
      started_at: campaign.started_at ?? timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Records a finished campaign.
   * @param id - Campaigns table identifier.
   * @param status - Terminal status to record.
   * @returns Updated campaign.
   */
  markFinished(
    id: number,
    status: "completed" | "cancelled" | "failed",
  ): DBCampaignRowType {
    const campaign = this.requireCampaign(id);
    const timestamp = new Date().toISOString();

    return this.applyStatus(campaign, {
      status,
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Records a cancellation request. Running tasks observe it at their next
   * cancellation check, so the campaign is not finished here.
   * @param id - Campaigns table identifier.
   * @returns Updated campaign.
   */
  requestCancellation(id: number): DBCampaignRowType {
    const campaign = this.requireCampaign(id);
    const timestamp = new Date().toISOString();

    return this.applyStatus(campaign, {
      status: "cancelled",
      cancel_requested_at: campaign.cancel_requested_at ?? timestamp,
      completed_at: timestamp,
      updated_at: timestamp,
    });
  }

  /**
   * Checks whether a campaign has been cancelled.
   * @param id - Campaigns table identifier.
   * @returns Whether cancellation was requested.
   */
  isCancelled(id: number): boolean {
    return this.findById(id)?.cancel_requested_at != null;
  }

  private applyStatus(
    campaign: DBCampaignRowType,
    changes: Partial<UpdateCampaignStatusParamsType>,
  ): DBCampaignRowType {
    this.updateStatusStatement.run({
      id: campaign.id,
      status: campaign.status,
      cancel_requested_at: campaign.cancel_requested_at,
      started_at: campaign.started_at,
      completed_at: campaign.completed_at,
      updated_at: campaign.updated_at,
      ...changes,
    });

    return this.findById(campaign.id)!;
  }

  private requireCampaign(id: number): DBCampaignRowType {
    const campaign = this.findById(id);

    if (!campaign) throw new Error(`Campaign ${id} does not exist.`);

    return campaign;
  }
}
