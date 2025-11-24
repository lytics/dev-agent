/**
 * Base Adapter Class
 * All adapters (Tool, Resource, Prompt) extend from this
 */

import type { AdapterContext, AdapterMetadata } from './types';

export abstract class Adapter {
  /**
   * Adapter metadata (name, version, description)
   */
  abstract readonly metadata: AdapterMetadata;

  /**
   * Initialize the adapter with context
   * Called once when adapter is registered
   */
  abstract initialize(context: AdapterContext): Promise<void>;

  /**
   * Optional: Cleanup when adapter is unregistered or server stops
   */
  shutdown?(): Promise<void>;

  /**
   * Optional: Health check for adapter
   * @returns true if healthy, false otherwise
   */
  healthCheck?(): Promise<boolean>;
}
