/**
 * @file qrScannerNative.test.js
 * @description Unit tests for the qrScannerNative Lightning Web Component.
 *
 * TEST PHILOSOPHY
 * ---------------
 * See biometricAuth.test.js for full documentation on the testing approach,
 * the two-strategy pattern (out-of-app vs in-app), and how to run the suite.
 *
 * QR Scanner-specific notes:
 *
 *   - median.barcode.scan() supports TWO invocation patterns:
 *       1. Promise — component awaits the resolved value directly.
 *       2. Callback — component registers window.median_barcode_scan_callback
 *          and passes { callback: 'median_barcode_scan_callback' } to scan().
 *          The native layer then invokes the global function with the result.
 *
 *   - median.barcode.setPrompt(text) is a synchronous call. It does not return
 *     a value. The test verifies it was called with the correct argument.
 *
 *   - On user cancellation the native layer returns { success: false, error: 'cancelled' }.
 *     The component must handle this gracefully without showing an error state.
 *
 *   - The raw JSON result is rendered in a resizable textarea. Tests verify the
 *     textarea content rather than parsed sub-fields, to remain decoupled from
 *     the exact display format.
 *
 * RUNNING THE TESTS
 * -----------------
 *   npm install          (from the repository root)
 *   npm test             — run once
 *   npm run test:watch   — watch mode
 */

import { createElement } from '@lwc/engine-dom';
import QrScannerNative from 'c/qrScannerNative';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createComponent() {
    const element = createElement('c-qr-scanner-native', { is: QrScannerNative });
    document.body.appendChild(element);
    return element;
}

/**
 * Builds a mock window.median bridge for the barcode scanner component.
 * scan() defaults to a successful QR code result.
 * setPrompt() is synchronous and returns undefined.
 */
function buildMockBridge() {
    return {
        barcode: {
            // Promise variant resolves with a successful scan result
            scan: jest.fn().mockResolvedValue({
                success: true,
                code: 'https://example.com/asset/12345',
                type: 'QR_CODE'
            }),
            // Synchronous — no return value
            setPrompt: jest.fn()
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
    delete window.median_barcode_scan_callback;
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1: Out-of-app behaviour
// ---------------------------------------------------------------------------

describe('c-qr-scanner-native — out-of-app (no Median bridge)', () => {

    it('renders the not-in-app warning banner when window.median is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        expect(banner).not.toBeNull();
    });

    it('disables all bridge-dependent buttons when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const promiseBtn  = element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]');
        const callbackBtn = element.shadowRoot.querySelector('lightning-button[label="Scan via Callback"]');
        const promptBtn   = element.shadowRoot.querySelector('lightning-button[label="Set Prompt"]');

        expect(promiseBtn.disabled).toBe(true);
        expect(callbackBtn.disabled).toBe(true);
        expect(promptBtn.disabled).toBe(true);
    });

    it('shows the empty output placeholder before any scan', async () => {
        const element = createComponent();
        await Promise.resolve();

        const placeholder = element.shadowRoot.querySelector('.output-box.empty');
        expect(placeholder).not.toBeNull();
        expect(placeholder.textContent).toContain('Scanned');
    });

    it('does not render the structured result card before any scan', async () => {
        const element = createComponent();
        await Promise.resolve();

        // The result card appears only after a successful scan
        const card = element.shadowRoot.querySelector('.result-card');
        expect(card).toBeNull();
    });

});

// ---------------------------------------------------------------------------
// Suite 2: Set Prompt
// ---------------------------------------------------------------------------

describe('c-qr-scanner-native — in-app, Set Custom Prompt', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('calls median.barcode.setPrompt() with the entered text', async () => {
        const element = createComponent();
        await Promise.resolve();

        // Enter a custom prompt string
        const promptInput = element.shadowRoot.querySelector('lightning-input[label="Custom Prompt Text"]');
        promptInput.dispatchEvent(new CustomEvent('change', {
            detail: { value: 'Align the QR code in the frame' }
        }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Set Prompt"]').click();
        await Promise.resolve();

        expect(window.median.barcode.setPrompt).toHaveBeenCalledWith('Align the QR code in the frame');
    });

    it('shows a success badge after setPrompt succeeds', async () => {
        const element = createComponent();
        await Promise.resolve();

        const promptInput = element.shadowRoot.querySelector('lightning-input[label="Custom Prompt Text"]');
        promptInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Scan here' } }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Set Prompt"]').click();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-success');
        expect(badge).not.toBeNull();
    });

    it('keeps the Set Prompt button disabled when the prompt input is empty', async () => {
        const element = createComponent();
        await Promise.resolve();

        const btn = element.shadowRoot.querySelector('lightning-button[label="Set Prompt"]');
        // No text entered — button must remain disabled
        expect(btn.disabled).toBe(true);
    });

});

// ---------------------------------------------------------------------------
// Suite 3: Scan via Promise
// ---------------------------------------------------------------------------

describe('c-qr-scanner-native — in-app, Scan via Promise', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('calls median.barcode.scan() with no arguments for the Promise variant', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.median.barcode.scan).toHaveBeenCalledTimes(1);
        expect(window.median.barcode.scan).toHaveBeenCalledWith();
    });

    it('renders the raw JSON result in the output textarea after a successful scan', async () => {
        window.median.barcode.scan.mockResolvedValueOnce({
            success: true,
            code: 'https://example.com/product/99',
            type: 'QR_CODE'
        });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const textarea = element.shadowRoot.querySelector('textarea.output-box');
        expect(textarea).not.toBeNull();
        expect(textarea.value).toContain('https://example.com/product/99');
        expect(textarea.value).toContain('QR_CODE');
    });

    it('renders the structured result card after a successful scan', async () => {
        window.median.barcode.scan.mockResolvedValueOnce({
            success: true,
            code: 'BARCODE-12345',
            type: 'CODE_128'
        });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const card = element.shadowRoot.querySelector('.result-card');
        expect(card).not.toBeNull();
        expect(card.textContent).toContain('BARCODE-12345');
        expect(card.textContent).toContain('CODE_128');
    });

    it('handles cancellation gracefully without rendering an error state', async () => {
        // When the user cancels the scanner, the native layer returns success: false
        window.median.barcode.scan.mockResolvedValueOnce({
            success: false,
            error: 'cancelled'
        });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]').click();
        await Promise.resolve();
        await Promise.resolve();

        // Result card must not appear on cancellation
        const card = element.shadowRoot.querySelector('.result-card');
        expect(card).toBeNull();

        // The error text element must not appear on cancellation
        const errorText = element.shadowRoot.querySelector('.error-text');
        expect(errorText).toBeNull();
    });

    it('clears result and output box when Clear Result is clicked', async () => {
        window.median.barcode.scan.mockResolvedValueOnce({
            success: true,
            code: 'https://example.com',
            type: 'QR_CODE'
        });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Promise"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('textarea.output-box')).not.toBeNull();

        element.shadowRoot.querySelector('lightning-button[label="Clear Result"]').click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('textarea.output-box')).toBeNull();
        expect(element.shadowRoot.querySelector('.output-box.empty')).not.toBeNull();
    });

});

// ---------------------------------------------------------------------------
// Suite 4: Scan via Callback
// ---------------------------------------------------------------------------

describe('c-qr-scanner-native — in-app, Scan via Callback', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('registers the global callback and passes its name to scan()', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Callback"]').click();
        await Promise.resolve();

        expect(typeof window.median_barcode_scan_callback).toBe('function');
        expect(window.median.barcode.scan).toHaveBeenCalledWith(
            expect.objectContaining({ callback: 'median_barcode_scan_callback' })
        );
    });

    it('renders the result when the native layer invokes the global callback with success', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Callback"]').click();
        await Promise.resolve();

        // Simulate the native layer calling back with a successful scan result
        window.median_barcode_scan_callback({
            success: true,
            code: 'https://median.co',
            type: 'QR_CODE'
        });
        await Promise.resolve();
        await Promise.resolve();

        const textarea = element.shadowRoot.querySelector('textarea.output-box');
        expect(textarea).not.toBeNull();
        expect(textarea.value).toContain('https://median.co');
    });

    it('shows a success badge after a successful callback scan', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Callback"]').click();
        await Promise.resolve();

        window.median_barcode_scan_callback({ success: true, code: 'abc', type: 'EAN_13' });
        await Promise.resolve();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-success');
        expect(badge).not.toBeNull();
    });

    it('shows an error badge when the callback fires with failure', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Scan via Callback"]').click();
        await Promise.resolve();

        window.median_barcode_scan_callback({ success: false, error: 'scanFailed' });
        await Promise.resolve();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-error');
        expect(badge).not.toBeNull();
    });

});