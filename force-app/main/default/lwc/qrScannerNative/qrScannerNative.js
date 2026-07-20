import { LightningElement, track } from 'lwc';

export default class MedianBarcodeScanner extends LightningElement {

    // ── Prompt ─────────────────────────────────────────────────────
    @track customPrompt  = '';
    @track promptStatus  = '';
    @track promptSuccess = null;   // true | false | null

    // ── Scan state ─────────────────────────────────────────────────
    @track isScanning  = false;
    @track scanResult  = null;    // { code, type, successLabel }
    @track rawOutput   = '';      // full JSON string shown in textarea
    @track scanStatus  = '';
    @track scanSuccess = null;    // true | false | null

    // ── Generic error ──────────────────────────────────────────────
    @track error = '';

    // ── Bridge accessor ────────────────────────────────────────────
    get _median() {
        return window.Median || window.Median || null;
    }

    // ── Computed helpers ───────────────────────────────────────────
    get isInMedianApp() {
        return !!this._median;
    }

    get isNotInApp() {
        return !this.isInMedianApp;
    }

    get isScanDisabled() {
        return !this.isInMedianApp || this.isScanning;
    }

    get isSetPromptDisabled() {
        return !this.isInMedianApp || !this.customPrompt.trim();
    }

    // Badge classes
    get promptBadgeClass() {
        if (this.promptSuccess === true)  return 'badge badge-success';
        if (this.promptSuccess === false) return 'badge badge-error';
        return 'badge badge-info';
    }

    get scanBadgeClass() {
        if (this.scanSuccess === true)  return 'badge badge-success';
        if (this.scanSuccess === false) return 'badge badge-error';
        return 'badge badge-info';
    }

    // ── Input handlers ─────────────────────────────────────────────
    handlePromptChange(event) {
        this.customPrompt = event.target.value;
    }

    // ── Set Custom Prompt ──────────────────────────────────────────
    /**
     * Dynamically updates the scanner prompt message shown in the
     * native scanner UI using median.barcode.setPrompt().
     */
    setPrompt() {
        this._clearErrors();
        this.promptStatus  = '';
        this.promptSuccess = null;

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        try {
            this._median.barcode.setPrompt(this.customPrompt.trim());
            this.promptSuccess = true;
            this.promptStatus  = 'Prompt updated successfully';
        } catch (e) {
            this.promptSuccess = false;
            this.promptStatus  = 'Failed to set prompt';
            this.error         = 'setPrompt error: ' + (e.message || e);
            console.error('[MedianBarcodeScanner] setPrompt error:', e);
        }
    }

    // ── Scan via Promise ───────────────────────────────────────────
    /**
     * Launches the native scanner and waits for the result via a
     * resolved Promise. No page navigation occurs — the result is
     * rendered directly into the output textbox and structured card.
     *
     * Returned data shape:
     *   { success: boolean, type: string, code: string, error?: string }
     */
    async scanViaPromise() {
        this._clearAll();
        this.isScanning = true;

        if (!this._median) {
            this.error      = 'Median bridge not found. Open this page inside the Median app.';
            this.isScanning = false;
            return;
        }

        try {
            const data = await this._median.barcode.scan();
            this._handleScanData(data, 'Promise');
        } catch (e) {
            this.scanSuccess = false;
            this.scanStatus  = 'Scan error';
            this.error       = 'scan() threw an error: ' + (e.message || e);
            console.error('[MedianBarcodeScanner] scanViaPromise error:', e);
        } finally {
            this.isScanning = false;
        }
    }

    // ── Scan via Callback ──────────────────────────────────────────
    /**
     * Launches the native scanner using the global-callback pattern.
     * A named function is registered on window so the native layer
     * can invoke it once the scan completes, passing the result back
     * into the LWC reactive state without any page redirect.
     */
    scanViaCallback() {
        this._clearAll();
        this.isScanning = true;

        if (!this._median) {
            this.error      = 'Median bridge not found. Open this page inside the Median app.';
            this.isScanning = false;
            return;
        }

        // Register global callback on window — required by Median bridge
        window.median_barcode_scan_callback = (data) => {
            this.isScanning = false;
            this._handleScanData(data, 'Callback');
        };

        try {
            this._median.barcode.scan({ callback: 'median_barcode_scan_callback' });
        } catch (e) {
            this.isScanning  = false;
            this.scanSuccess = false;
            this.scanStatus  = 'Scan error';
            this.error       = 'scan() threw an error: ' + (e.message || e);
            console.error('[MedianBarcodeScanner] scanViaCallback error:', e);
        }
    }

    // ── Shared result handler ──────────────────────────────────────
    /**
     * Normalises the raw data object returned by the scanner,
     * populates the raw JSON output textbox, and sets up the
     * structured result card.
     *
     * @param {Object} data   - Raw scan result from the Median bridge
     * @param {string} source - 'Promise' | 'Callback' — for the status badge label
     */
    _handleScanData(data, source) {
        // Always show the full raw JSON in the output textbox
        try {
            this.rawOutput = JSON.stringify(data, null, 2);
        } catch (_) {
            this.rawOutput = String(data);
        }

        if (data && data.success) {
            this.scanResult = {
                code:         data.code  || '(empty)',
                type:         data.type  || '(unknown)',
                successLabel: 'true'
            };
            this.scanSuccess = true;
            this.scanStatus  = `Scanned via ${source}`;
        } else {
            const reason = (data && data.error) ? data.error : 'Scan unsuccessful or cancelled';
            this.scanResult  = null;
            this.scanSuccess = false;
            this.scanStatus  = reason;
        }
    }

    // ── Clear ──────────────────────────────────────────────────────
    clearResult() {
        this._clearAll();
    }

    // ── Internal helpers ───────────────────────────────────────────
    _clearErrors() {
        this.error = '';
    }

    _clearAll() {
        this.error       = '';
        this.rawOutput   = '';
        this.scanResult  = null;
        this.scanStatus  = '';
        this.scanSuccess = null;
        this.isScanning  = false;
    }
}