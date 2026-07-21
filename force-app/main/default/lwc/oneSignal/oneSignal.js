import { LightningElement, track } from 'lwc';

export default class MedianOneSignal extends LightningElement {

    // ── Reactive state ──────────────────────────────────────────────
    @track oneSignalInfo    = null;
    @track externalUserId   = '';
    @track loginStatus      = '';
    @track loginSuccess     = null;   // true | false | null
    @track error            = '';

    // ── Computed helpers ────────────────────────────────────────────

    /** True when running inside the Median mobile app */
    get isInMedianApp() {
        return typeof window.Median !== 'undefined' || typeof window.median !== 'undefined';
    }

    /** Inverse, used for disabled attributes */
    get isNotInApp() {
        return !this.isInMedianApp;
    }

    /** Disable Login button when no ID entered or not in app */
    get isLoginDisabled() {
        return !this.isInMedianApp || !this.externalUserId.trim();
    }

    /** Pretty-printed JSON for the info box */
    get oneSignalInfoJson() {
        try {
            return JSON.stringify(this.oneSignalInfo, null, 2);
        } catch (e) {
            return String(this.oneSignalInfo);
        }
    }

    /** Dynamic CSS class for the login status badge */
    get loginStatusBadgeClass() {
        if (this.loginSuccess === true)  return 'status-badge success';
        if (this.loginSuccess === false) return 'status-badge error';
        return 'status-badge info';
    }

    // ── Median bridge accessor ──────────────────────────────────────

    /** Returns the median bridge object, normalising both casing conventions */
    get _median() {
        return window.median || window.Median || null;
    }

    // ── Info Methods ────────────────────────────────────────────────

    /**
     * Fetch OneSignal info using the Promise / async approach.
     * median.onesignal.info() resolves with the info object.
     */
    async getInfoViaPromise() {
        this._clearState();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        try {
            const info = await this._median.onesignal.info();
            this.oneSignalInfo = info;
        } catch (e) {
            this.error = 'Failed to retrieve OneSignal info: ' + (e.message || e);
            console.error('[MedianOneSignal] getInfoViaPromise error:', e);
        }
    }

    /**
     * Fetch OneSignal info using the global callback convention.
     * The native app will call window.median_onesignal_info() on page load,
     * but we can also trigger it manually for SPAs.
     */
    getInfoViaCallback() {
        this._clearState();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        // Register the global callback (must be on window)
        window.median_onesignal_info = (info) => {
            this.oneSignalInfo = info;
        };

        // Manually trigger the info call for single-page app contexts
        try {
            this._median.onesignal.info({ callback: 'median_onesignal_info' });
        } catch (e) {
            this.error = 'Failed to request OneSignal info: ' + (e.message || e);
            console.error('[MedianOneSignal] getInfoViaCallback error:', e);
        }
    }

    /** Clear the info display panel */
    clearInfo() {
        this.oneSignalInfo = null;
        this.error = '';
    }

    // ── User Management ─────────────────────────────────────────────

    /** Handle text input changes for the external user ID field */
    handleUserIdChange(event) {
        this.externalUserId = event.target.value;
    }

    /**
     * Login a user with the Median OneSignal plugin.
     * median.onesignal.login(externalId) returns a Promise that resolves
     * with { success: true/false }.
     */
    async loginUser() {
        this._clearState();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        const userId = this.externalUserId.trim();
        if (!userId) {
            this.error = 'Please enter an External User ID before logging in.';
            return;
        }

        try {
            this.loginStatus = 'Logging in…';
            const result = await this._median.onesignal.login(userId);

            if (result && result.success === false) {
                this.loginSuccess = false;
                this.loginStatus  = 'Login failed';
                this.error        = 'OneSignal login was unsuccessful. Check the console for details.';
            } else {
                this.loginSuccess = true;
                this.loginStatus  = `Logged in as: ${userId}`;
            }
        } catch (e) {
            this.loginSuccess = false;
            this.loginStatus  = 'Login error';
            this.error        = 'Login threw an error: ' + (e.message || e);
            console.error('[MedianOneSignal] loginUser error:', e);
        }
    }

    /**
     * Logout the current user from the Median OneSignal plugin.
     * median.onesignal.logout() removes the external ID association
     * so this device will no longer receive personalised notifications.
     */
    async logoutUser() {
        this._clearState();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        try {
            this.loginStatus = 'Logging out…';
            await this._median.onesignal.logout();
            this.loginSuccess    = true;
            this.loginStatus     = 'Logged out successfully';
            this.externalUserId  = '';
        } catch (e) {
            this.loginSuccess = false;
            this.loginStatus  = 'Logout error';
            this.error        = 'Logout threw an error: ' + (e.message || e);
            console.error('[MedianOneSignal] logoutUser error:', e);
        }
    }

    // ── Internal helpers ────────────────────────────────────────────

    _clearState() {
        this.error        = '';
        this.loginStatus  = '';
        this.loginSuccess = null;
    }
}