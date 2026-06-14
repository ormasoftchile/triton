export interface JourneyTask {
  name: string;
  score: number;
  actors: string[];
}

export interface JourneySection {
  name: string;
  tasks: JourneyTask[];
}

export interface JourneyMetadata {
  title?: string;
  theme?: string;
}

export interface JourneyDocument {
  version: string;
  metadata: JourneyMetadata;
  sections: JourneySection[];
  preambleTasks: JourneyTask[];
}
