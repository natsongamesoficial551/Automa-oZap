export interface InboundMessageRecord {
  id: string;
  companyId: string;
  from: string;
  text: string;
  providerMessageId: string;
  createdAt: string;
}

const memoryStore = new Map<string, InboundMessageRecord>();

export async function saveInboundMessage(record: InboundMessageRecord): Promise<void> {
  memoryStore.set(record.id, record);
}

export async function inboundMessageExists(providerMessageId: string): Promise<boolean> {
  for (const item of memoryStore.values()) {
    if (item.providerMessageId === providerMessageId) {
      return true;
    }
  }

  return false;
}
