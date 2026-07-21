/**
 * @file pdfViewer.test.js
 * @description Unit tests for the pdfViewer Lightning Web Component.
 *
 * TEST PHILOSOPHY
 * ---------------
 * See biometricAuth.test.js for full documentation on the testing approach,
 * the two-strategy pattern (out-of-app vs in-app), and how to run the suite.
 *
 * PDF Viewer-specific notes:
 *
 *   - OPEN uses window.location.href, NOT the Median bridge. This means the
 *     Open button works (and is enabled) even outside the Median app. In a
 *     desktop browser, setting window.location.href navigates the tab to the
 *     PDF URL. Inside the Median app, the native layer intercepts this navigation
 *     and renders the PDF using PDFKit (iOS) or PDFViewer (Android).
 *
 *     In Jest/jsdom, window.location is not fully writable by default.
 *     We use Object.defineProperty to replace the href setter with a Jest spy
 *     so we can assert it was called without actually navigating jsdom.
 *
 *   - DOWNLOAD uses median.share.downloadFile({ url, open: false }).
 *     This requires the bridge and is disabled outside the Median app.
 *
 *   - The component has a hardcoded DEFAULT_PDF_URL constant at the top of
 *     pdfViewer.js. Tests that check the URL field default value should match
 *     this constant. If the constant is changed, update the assertion below.
 *
 * RUNNING THE TESTS
 * -----------------
 *   npm install          (from the repository root)
 *   npm test             — run once
 *   npm run test:watch   — watch mode
 */

import { createElement } from '@lwc/engine-dom';
import PdfViewer from 'c/pdfViewer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createComponent() {
    const element = createElement('c-pdf-viewer', { is: PdfViewer });
    document.body.appendChild(element);
    return element;
}

function buildMockBridge() {
    return {
        share: {
            // downloadFile({ url, open }) — resolves with undefined on success
            downloadFile: jest.fn().mockReturnValue(undefined)
        }
    };
}

/**
 * Replaces window.location.href with a writable Jest spy.
 * jsdom does not allow direct assignment to window.location.href in strict mode,
 * so we use Object.defineProperty to install a controllable setter.
 *
 * @returns {{ hrefSetter: jest.Mock, restore: Function }}
 */
function mockWindowLocationHref() {
    const hrefSetter = jest.fn();
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...window.location,
            set href(value) { hrefSetter(value); },
            get href()      { return 'http://localhost/'; }
        }
    });

    return {
        hrefSetter,
        restore: () => {
            if (originalDescriptor) {
                Object.defineProperty(window, 'location', originalDescriptor);
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    delete window.median;
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1: Out-of-app behaviour
// ---------------------------------------------------------------------------

describe('c-pdf-viewer — out-of-app (no Median bridge)', () => {

    it('renders the not-in-app warning banner when window.median is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        expect(banner).not.toBeNull();
    });

    it('enables the Open PDF button even without the bridge (uses window.location.href)', async () => {
        const element = createComponent();
        await Promise.resolve();

        // Open does not need the bridge — it should be enabled if a URL is present
        const openBtn = element.shadowRoot.querySelector('lightning-button[label="Open PDF in App"]');
        expect(openBtn.disabled).toBe(false);
    });

    it('disables the Download PDF button when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        // Download requires median.share.downloadFile — must be disabled without bridge
        const downloadBtn = element.shadowRoot.querySelector('lightning-button[label="Download PDF"]');
        expect(downloadBtn.disabled).toBe(true);
    });

    it('pre-populates the URL field with the hardcoded default PDF URL', async () => {
        const element = createComponent();
        await Promise.resolve();

        // The component initialises pdfUrl from DEFAULT_PDF_URL.
        // If you change the constant in pdfViewer.js, update this assertion.
        const urlInput = element.shadowRoot.querySelector('lightning-input[type="url"]');
        expect(urlInput).not.toBeNull();
        expect(urlInput.value).toBeTruthy(); // default URL is set
        expect(urlInput.value).toMatch(/^https?:\/\//); // must be a valid URL
    });

    it('renders the active URL in the read-only output textarea', async () => {
        const element = createComponent();
        await Promise.resolve();

        const textarea = element.shadowRoot.querySelector('textarea.output-box');
        expect(textarea).not.toBeNull();
        expect(textarea.value).toMatch(/^https?:\/\//);
    });

});

// ---------------------------------------------------------------------------
// Suite 2: Open PDF (window.location.href — no bridge required)
// ---------------------------------------------------------------------------

describe('c-pdf-viewer — Open PDF (window.location.href)', () => {

    it('sets window.location.href to the active PDF URL when Open is clicked', async () => {
        const { hrefSetter, restore } = mockWindowLocationHref();

        try {
            const element = createComponent();
            await Promise.resolve();

            element.shadowRoot.querySelector('lightning-button[label="Open PDF in App"]').click();
            await Promise.resolve();

            // location.href must have been set to the current pdfUrl value
            expect(hrefSetter).toHaveBeenCalledTimes(1);
            expect(hrefSetter.mock.calls[0][0]).toMatch(/^https?:\/\//);
        } finally {
            restore();
        }
    });

    it('sets window.location.href to a custom URL entered by the user', async () => {
        const { hrefSetter, restore } = mockWindowLocationHref();

        try {
            const element = createComponent();
            await Promise.resolve();

            // User types a custom URL
            const urlInput = element.shadowRoot.querySelector('lightning-input[type="url"]');
            urlInput.dispatchEvent(new CustomEvent('change', {
                detail: { value: 'https://custom.example.com/report.pdf' }
            }));
            await Promise.resolve();

            element.shadowRoot.querySelector('lightning-button[label="Open PDF in App"]').click();
            await Promise.resolve();

            expect(hrefSetter).toHaveBeenCalledWith('https://custom.example.com/report.pdf');
        } finally {
            restore();
        }
    });

    it('shows a success status badge after triggering Open', async () => {
        const { restore } = mockWindowLocationHref();

        try {
            const element = createComponent();
            await Promise.resolve();

            element.shadowRoot.querySelector('lightning-button[label="Open PDF in App"]').click();
            await Promise.resolve();

            const badge = element.shadowRoot.querySelector('.badge-success');
            expect(badge).not.toBeNull();
        } finally {
            restore();
        }
    });

    it('disables Open button and shows an error when the URL field is cleared', async () => {
        const element = createComponent();
        await Promise.resolve();

        const urlInput = element.shadowRoot.querySelector('lightning-input[type="url"]');
        urlInput.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
        await Promise.resolve();

        const openBtn = element.shadowRoot.querySelector('lightning-button[label="Open PDF in App"]');
        // With an empty URL the button must be disabled regardless of bridge presence
        expect(openBtn.disabled).toBe(true);
    });

});

// ---------------------------------------------------------------------------
// Suite 3: Download PDF (Median bridge required)
// ---------------------------------------------------------------------------

describe('c-pdf-viewer — in-app, Download PDF', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('enables the Download button when the bridge is present and URL is set', async () => {
        const element = createComponent();
        await Promise.resolve();

        const downloadBtn = element.shadowRoot.querySelector('lightning-button[label="Download PDF"]');
        expect(downloadBtn.disabled).toBe(false);
    });

    it('calls median.share.downloadFile() with open: false when Download is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Download PDF"]').click();
        await Promise.resolve();

        expect(window.median.share.downloadFile).toHaveBeenCalledTimes(1);
        const callArgs = window.median.share.downloadFile.mock.calls[0][0];
        expect(callArgs).toHaveProperty('open', false);
        expect(callArgs).toHaveProperty('url');
        expect(callArgs.url).toMatch(/^https?:\/\//);
    });

    it('passes the user-entered custom URL to downloadFile()', async () => {
        const element = createComponent();
        await Promise.resolve();

        const urlInput = element.shadowRoot.querySelector('lightning-input[type="url"]');
        urlInput.dispatchEvent(new CustomEvent('change', {
            detail: { value: 'https://files.example.com/contract.pdf' }
        }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Download PDF"]').click();
        await Promise.resolve();

        const callArgs = window.median.share.downloadFile.mock.calls[0][0];
        expect(callArgs.url).toBe('https://files.example.com/contract.pdf');
    });

    it('shows a success badge after Download is triggered', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Download PDF"]').click();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-success');
        expect(badge).not.toBeNull();
    });

});

// ---------------------------------------------------------------------------
// Suite 4: Clear URL
// ---------------------------------------------------------------------------

describe('c-pdf-viewer — Clear URL', () => {

    it('clears the URL field, textarea, and status when Clear is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Clear"]').click();
        await Promise.resolve();

        const urlInput = element.shadowRoot.querySelector('lightning-input[type="url"]');
        const textarea  = element.shadowRoot.querySelector('textarea.output-box');
        expect(urlInput.value).toBe('');
        expect(textarea.value).toBe('');
    });

    it('disables the Clear button after the URL has been cleared', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Clear"]').click();
        await Promise.resolve();

        const clearBtn = element.shadowRoot.querySelector('lightning-button[label="Clear"]');
        expect(clearBtn.disabled).toBe(true);
    });

});