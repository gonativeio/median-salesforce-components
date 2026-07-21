import { LightningElement, track } from 'lwc';

export default class MedianAuth extends LightningElement {

    // ── Save-secret inputs ─────────────────────────────────────────
    @track saveUsername  = '';
    @track savePassword  = '';

    // ── Status section ─────────────────────────────────────────────
    @track biometricStatus = null;   // raw object from median.auth.status()

    // ── Save feedback ──────────────────────────────────────────────
    @track saveStatus       = '';
    @track saveSuccess      = null;  // true | false | null

    // ── Retrieve feedback ──────────────────────────────────────────
    @track retrievedOutput      = '';   // shown in the output textbox
    @track retrieveStatus       = '';
    @track retrieveSuccess      = null; // true | false | null

    // ── Generic error ──────────────────────────────────────────────
    @track error = '';

    // ── Bridge accessor ────────────────────────────────────────────
    get _median() {
        return window.median || window.Median || null;
    }

    // ── Computed helpers ───────────────────────────────────────────
    get isInMedianApp() {
        return !!this._median;
    }

    get isNotInApp() {
        return !this.isInMedianApp;
    }

    get isSaveDisabled() {
        return !this.isInMedianApp || !this.saveUsername.trim() || !this.savePassword.trim();
    }

    // Biometric status display helpers
    get hasTouchIdLabel() {
        return this.biometricStatus?.hasTouchId ? 'Yes' : 'No';
    }
    get hasSecretLabel() {
        return this.biometricStatus?.hasSecret ? 'Yes' : 'No';
    }
    get hasTouchIdBadgeClass() {
        return this.biometricStatus?.hasTouchId ? 'badge badge-success' : 'badge badge-warn';
    }
    get hasSecretBadgeClass() {
        return this.biometricStatus?.hasSecret ? 'badge badge-success' : 'badge badge-warn';
    }

    // Save status badge
    get saveStatusBadgeClass() {
        if (this.saveSuccess === true)  return 'badge badge-success';
        if (this.saveSuccess === false) return 'badge badge-error';
        return 'badge badge-info';
    }

    // Retrieve status badge
    get retrieveStatusBadgeClass() {
        if (this.retrieveSuccess === true)  return 'badge badge-success';
        if (this.retrieveSuccess === false) return 'badge badge-error';
        return 'badge badge-info';
    }

    // ── Input handlers ─────────────────────────────────────────────
    handleSaveUsernameChange(event) {
        this.saveUsername = event.target.value;
    }

    handleSavePasswordChange(event) {
        this.savePassword = event.target.value;
    }

    // ── Biometric Status ───────────────────────────────────────────
    /**
     * Check whether the device has biometric capability and a stored secret.
     * Uses median.auth.status() as a Promise.
     *
     * Returns: { hasTouchId: boolean, hasSecret: boolean }
     */
    async checkStatus() {
        this._clearErrors();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        try {
            const status = await this._median.auth.status();
            this.biometricStatus = status;
        } catch (e) {
            this.error = 'Failed to check biometric status: ' + (e.message || e);
            console.error('[MedianAuth] checkStatus error:', e);
        }
    }

    // ── Save Secret ────────────────────────────────────────────────
    /**
     * Bundles the username and password into a JSON string and saves
     * it to the iOS Keychain / Android Keystore via median.auth.save().
     *
     * Saving does NOT require biometric interaction — it stores the
     * secret silently and the user authenticates only on retrieval.
     */
    async saveSecret() {
        this._clearErrors();
        this.saveStatus  = '';
        this.saveSuccess = null;

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        // First confirm the device supports biometrics before saving
        let status;
        try {
            status = await this._median.auth.status();
            this.biometricStatus = status;
        } catch (e) {
            this.error = 'Could not determine biometric availability: ' + (e.message || e);
            return;
        }

        if (!status || !status.hasTouchId) {
            this.saveSuccess = false;
            this.saveStatus  = 'Biometrics unavailable on this device';
            return;
        }

        // Encode credentials as a JSON string (the "secret")
        const secret = JSON.stringify({
            username: this.saveUsername.trim(),
            password: this.savePassword
        });

        try {
            this.saveStatus = 'Saving…';
            const result = await this._median.auth.save({
                secret: secret,
                minimumAndroidBiometric: 'strong'
            });

            // result may be undefined on success on some versions — treat that as OK
            if (result && result.success === false) {
                this.saveSuccess = false;
                this.saveStatus  = 'Save failed';
                this.error       = 'The secret could not be saved. Check the console for details.';
            } else {
                this.saveSuccess = true;
                this.saveStatus  = `Secret saved for "${this.saveUsername.trim()}"`;
            }
        } catch (e) {
            this.saveSuccess = false;
            this.saveStatus  = 'Save error';
            this.error       = 'Save threw an error: ' + (e.message || e);
            console.error('[MedianAuth] saveSecret error:', e);
        }
    }

    // ── Delete Secret ──────────────────────────────────────────────
    /**
     * Removes the stored secret from the device keychain/keystore.
     * median.auth.delete() — no biometric prompt required.
     */
    async deleteSecret() {
        this._clearErrors();
        this.saveStatus  = '';
        this.saveSuccess = null;

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        try {
            this.saveStatus = 'Deleting…';
            await this._median.auth.delete();
            this.saveSuccess     = true;
            this.saveStatus      = 'Saved secret deleted from device';
            this.biometricStatus = null; // force a re-check next time
            this.retrievedOutput = '';
            this.retrieveStatus  = '';
            this.retrieveSuccess = null;
        } catch (e) {
            this.saveSuccess = false;
            this.saveStatus  = 'Delete error';
            this.error       = 'Delete threw an error: ' + (e.message || e);
            console.error('[MedianAuth] deleteSecret error:', e);
        }
    }

    // ── Retrieve Secret ────────────────────────────────────────────
    /**
     * Triggers a biometric prompt. On success the saved secret string
     * is returned via the global callback and rendered in the output
     * textbox — no page navigation occurs.
     *
     * Uses the global-callback pattern so the result can be captured
     * inside an LWC component's reactive state.
     *
     * Returns via callback:
     *   { success: true,  secret: '<json string>' }  on success
     *   { success: false, error: 'authenticationFailed' } on failure
     */
    getSecret() {
        this._clearErrors();
        this.retrievedOutput = '';
        this.retrieveStatus  = 'Waiting for biometric prompt…';
        this.retrieveSuccess = null;

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            this.retrieveStatus = '';
            return;
        }

        // Register the global callback — must live on window
        window.median_auth_get_callback = (data) => {
            if (data && data.success && data.secret) {
                // Parse and pretty-print the JSON secret for readability
                try {
                    const parsed = JSON.parse(data.secret);
                    this.retrievedOutput = JSON.stringify(parsed, null, 2);
                } catch (_) {
                    // If not JSON, show raw string
                    this.retrievedOutput = data.secret;
                }
                this.retrieveSuccess = true;
                this.retrieveStatus  = 'Secret retrieved successfully';
            } else {
                const reason = (data && data.error) ? data.error : 'Unknown error';
                this.retrieveSuccess = false;
                this.retrieveStatus  = 'Authentication failed: ' + reason;
                this.retrievedOutput = '';
            }
        };

        try {
            this._median.auth.get({ callbackFunction: 'median_auth_get_callback' });
        } catch (e) {
            this.retrieveSuccess = false;
            this.retrieveStatus  = 'Get error';
            this.error           = 'Get secret threw an error: ' + (e.message || e);
            console.error('[MedianAuth] getSecret error:', e);
        }
    }

    // ── Clear output ───────────────────────────────────────────────
    clearOutput() {
        this.retrievedOutput = '';
        this.retrieveStatus  = '';
        this.retrieveSuccess = null;
        this._clearErrors();
    }

    // ── Internal helpers ───────────────────────────────────────────
    _clearErrors() {
        this.error = '';
    }
}