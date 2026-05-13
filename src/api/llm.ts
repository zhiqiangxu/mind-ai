import { getActiveProvider } from '../config';
import { streamAnthropic } from './anthropic';
import { streamDeepseek } from './deepseek';

export async function streamAnswer(nodeId: string): Promise<void> {
  const provider = await getActiveProvider();
  switch (provider) {
    case 'anthropic':
      return streamAnthropic(nodeId);
    case 'deepseek':
      return streamDeepseek(nodeId);
  }
}
