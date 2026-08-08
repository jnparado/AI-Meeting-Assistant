export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { uri?: string; entryPointType?: string }[];
  };
  location?: string;
};
