/**
 * Ollama translates this schema into grammar rules via `llama.cpp`
 * to ensure the model's output strictly adheres to your specific
 * data structure.
 */
export const resumeInferenceSchemaVersion = "v1";

export const resumeInferenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "targetRoles",
    "skills",
    "experience",
    "education",
    "certifications",
    "languages",
    "locationPreferences",
    "workAuthorization",
  ],
  properties: {
    headline: { type: ["string", "null"] },
    targetRoles: {
      type: "array",
      items: { type: "string" },
    },
    skills: {
      type: "array",
      items: { type: "string" },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company",
          "title",
          "location",
          "isRemote",
          "startDate",
          "endDate",
          "highlights",
          "skills",
        ],
        properties: {
          company: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          isRemote: { type: ["boolean", "null"] },
          startDate: {
            anyOf: [{ $ref: "#/$defs/date" }, { type: "null" }],
          },
          endDate: {
            anyOf: [{ $ref: "#/$defs/date" }, { type: "null" }],
          },
          highlights: {
            type: "array",
            items: { type: "string" },
          },
          skills: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "institution",
          "degree",
          "fieldOfStudy",
          "startDate",
          "endDate",
        ],
        properties: {
          institution: { type: ["string", "null"] },
          degree: { type: ["string", "null"] },
          fieldOfStudy: { type: ["string", "null"] },
          startDate: {
            anyOf: [{ $ref: "#/$defs/date" }, { type: "null" }],
          },
          endDate: {
            anyOf: [{ $ref: "#/$defs/date" }, { type: "null" }],
          },
        },
      },
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "issuer", "issuedDate"],
        properties: {
          name: { type: ["string", "null"] },
          issuer: { type: ["string", "null"] },
          issuedDate: {
            anyOf: [{ $ref: "#/$defs/date" }, { type: "null" }],
          },
        },
      },
    },
    languages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["language", "proficiency"],
        properties: {
          language: { type: "string" },
          proficiency: {
            type: ["string", "null"],
            enum: [
              "native",
              "fluent",
              "professional",
              "intermediate",
              "basic",
              "other",
              null,
            ],
          },
        },
      },
    },
    locationPreferences: {
      type: "object",
      additionalProperties: false,
      required: [
        "currentLocation",
        "preferredLocations",
        "remotePreference",
        "willingToRelocate",
      ],
      properties: {
        currentLocation: {
          anyOf: [{ $ref: "#/$defs/location" }, { type: "null" }],
        },
        preferredLocations: {
          type: "array",
          items: { $ref: "#/$defs/location" },
        },
        remotePreference: {
          type: ["string", "null"],
          enum: ["remote", "hybrid", "onsite", "flexible", null],
        },
        willingToRelocate: { type: ["boolean", "null"] },
      },
    },
    workAuthorization: {
      type: "object",
      additionalProperties: false,
      required: [
        "nationalities",
        "authorizedCountries",
        "requiresVisaSponsorship",
        "sourceText",
      ],
      properties: {
        nationalities: {
          type: "array",
          items: { type: "string" },
        },
        authorizedCountries: {
          type: "array",
          items: { type: "string" },
        },
        requiresVisaSponsorship: { type: ["boolean", "null"] },
        sourceText: { type: ["string", "null"] },
      },
    },
  },
  $defs: {
    date: {
      type: "object",
      additionalProperties: false,
      required: ["value", "precision"],
      properties: {
        value: { type: "string" },
        precision: {
          type: "string",
          enum: ["year", "month", "day"],
        },
      },
    },
    location: {
      type: "object",
      additionalProperties: false,
      required: ["city", "stateOrRegion", "country"],
      properties: {
        city: { type: ["string", "null"] },
        stateOrRegion: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
      },
    },
  },
} as const;
