import { LightningElement, track } from 'lwc';

// ── Hardcoded default PDF URL ──────────────────────────────────────────────
// Change this to your own publicly accessible PDF URL.
const DEFAULT_PDF_URL = 'https://medianco.my.salesforce.com/sfc/p/am00001ayiQl/a/am000000evh7/MI_TfGjcEm9e1d5chR4bVhS4YZewJnDFqbNQis7Zszs';

export default class MedianPdfViewer extends LightningElement {

    @track pdfUrl      = DEFAULT_PDF_URL;
    @track actionStatus  = '';
    @track actionSuccess = null;
    @track error         = '';

    // ── Median bridge accessor ─────────────────────────────────────
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

    // Open uses window.location — no bridge required, just needs a URL
    get isOpenDisabled() {
        return !this.pdfUrl.trim();
    }

    // Download still uses the Median bridge
    get isDownloadDisabled() {
        return !this.isInMedianApp || !this.pdfUrl.trim();
    }

    get isNoPdfUrl() {
        return !this.pdfUrl.trim();
    }

    get actionBadgeClass() {
        if (this.actionSuccess === true)  return 'badge badge-success';
        if (this.actionSuccess === false) return 'badge badge-error';
        return 'badge badge-info';
    }

    // ── Input handler ──────────────────────────────────────────────
    handleUrlChange(event) {
        this.pdfUrl      = event.target.value;
        this.actionStatus  = '';
        this.actionSuccess = null;
        this.error         = '';
    }

    // ── Open ───────────────────────────────────────────────────────
    /**
     * Opens the PDF by navigating the webview directly to the URL via
     * window.location.href — the same approach used by the Median demo
     * at https://median.dev/pdf-download.
     *
     * Inside the Median app the native PDF viewer (PDFKit on iOS,
     * PDFViewer on Android) intercepts the navigation and renders the
     * document. No bridge call is required.
     */
    openPdf() {
        this._clearState();

        const url = this.pdfUrl.trim();
        if (!url) {
            this.error = 'Please enter a PDF URL first.';
            return;
        }

        try {
            window.location.href = url;
            this.actionSuccess = true;
            this.actionStatus  = 'Navigating to PDF…';
        } catch (e) {
            this.actionSuccess = false;
            this.actionStatus  = 'Open failed';
            this.error         = 'openPdf error: ' + (e.message || e);
            console.error('[MedianPdfViewer] openPdf error:', e);
        }
    }

    // ── Download ───────────────────────────────────────────────────
    /**
     * Downloads the PDF to the device.
     * iOS:     Triggers the native Share / Save to Files sheet.
     * Android: Downloads silently to the Downloads folder
     *          (or shows "Open with" if Private to App is enabled).
     *
     * open: false tells the bridge to download without immediately
     * opening the native viewer — the user controls what to do next.
     */
    downloadPdf() {
        this._clearState();

        if (!this._median) {
            this.error = 'Median bridge not found. Open this page inside the Median app.';
            return;
        }

        const url = this.pdfUrl.trim();
        if (!url) {
            this.error = 'Please enter a PDF URL first.';
            return;
        }

        try {
            this._median.share.downloadFile({ url, open: false });
            this.actionSuccess = true;
            this.actionStatus  = 'Download triggered — check your device Files / Downloads.';
        } catch (e) {
            this.actionSuccess = false;
            this.actionStatus  = 'Download failed';
            this.error         = 'downloadPdf error: ' + (e.message || e);
            console.error('[MedianPdfViewer] downloadPdf error:', e);
        }
    }

    // ── Clear ──────────────────────────────────────────────────────
    clearUrl() {
        this.pdfUrl      = '';
        this._clearState();
    }

    // ── Internal ───────────────────────────────────────────────────
    _clearState() {
        this.actionStatus  = '';
        this.actionSuccess = null;
        this.error         = '';
    }
}