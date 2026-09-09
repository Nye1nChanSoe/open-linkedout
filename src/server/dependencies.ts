import { BrowserSession } from "@/app/browser/browser-session.js";
import { AppEventBus } from "@/app/events/app-event-bus.js";
import { CampaignService } from "@/app/services/campaign.service.js";
import { ResumeService } from "@/app/services/resume.service.js";
import { JobDetailRepository } from "@database/repositories/job-detail.repository.js";
import { JobDiscoveryRepository } from "@database/repositories/job-discovery.repository.js";
import { JobRepository } from "@database/repositories/job.repository.js";
import { ResumeExtractionRepository } from "@database/repositories/resume-extraction.repository.js";
import { ResumeRepository } from "@database/repositories/resume.repository.js";
import { SchedulerTaskRepository } from "@database/repositories/scheduler-task.repository.js";

/** Everything the HTTP layer reads and writes through. */
export type ServerDependenciesType = {
  appEventBus: AppEventBus;
  browserSession: BrowserSession;
  campaignService: CampaignService;
  resumeService: ResumeService;
  jobRepository: JobRepository;
  jobDetailRepository: JobDetailRepository;
  jobDiscoveryRepository: JobDiscoveryRepository;
  resumeRepository: ResumeRepository;
  resumeExtractionRepository: ResumeExtractionRepository;
  schedulerTaskRepository: SchedulerTaskRepository;
};
