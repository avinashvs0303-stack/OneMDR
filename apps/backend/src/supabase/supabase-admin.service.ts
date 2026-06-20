import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface InviteUserOptions {
  email: string;
  redirectTo: string;
  userMetadata?: Record<string, unknown>;
  appMetadata: {
    user_id: string;
    tenant_id: string;
    app_role: string;
    tenant_type: string;
  };
}

@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient;
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  /**
   * Invite a user by email. Supabase sends the invite email automatically.
   * After the user accepts, we set app_metadata with their tenant/role claims.
   * Returns the Supabase auth user ID (supabase_uid) to store in our users table.
   */
  async inviteUser(opts: InviteUserOptions): Promise<string> {
    const { data, error } = await this.client.auth.admin.inviteUserByEmail(opts.email, {
      redirectTo: opts.redirectTo,
      data: opts.userMetadata ?? {},
    });

    if (error || !data.user) {
      this.logger.error({ error, email: opts.email }, 'Failed to invite user via Supabase');
      throw new Error(error?.message ?? 'Failed to invite user');
    }

    const supabaseUid = data.user.id;

    // Set app_metadata with our user_id, tenant_id, app_role.
    // app_metadata is only writable by service_role — never by the browser.
    const { error: metaError } = await this.client.auth.admin.updateUserById(supabaseUid, {
      app_metadata: opts.appMetadata,
    });

    if (metaError) {
      this.logger.error({ error: metaError, supabaseUid }, 'Failed to set app_metadata');
      throw new Error(metaError.message);
    }

    this.logger.log(`User invited: ${opts.email} (supabase_uid=${supabaseUid})`);
    return supabaseUid;
  }

  /**
   * Update app_metadata for an existing Supabase auth user.
   * Used to update role or tenant assignment.
   */
  async updateUserAppMetadata(
    supabaseUid: string,
    appMetadata: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(supabaseUid, {
      app_metadata: appMetadata,
    });
    if (error) throw new Error(error.message);
  }

  /**
   * Permanently delete a Supabase auth user.
   * Call this when deprovisioning a user from the platform.
   */
  async deleteUser(supabaseUid: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(supabaseUid);
    if (error) throw new Error(error.message);
  }
}
