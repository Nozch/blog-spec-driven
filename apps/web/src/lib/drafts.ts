type DraftPayload = {
  content: unknown;
};

let inMemoryDraft: DraftPayload | null = null;

export const saveDraft = async (payload: DraftPayload): Promise<void> => {
  inMemoryDraft = payload;
};

export const loadDraft = async (): Promise<DraftPayload | null> => inMemoryDraft;
