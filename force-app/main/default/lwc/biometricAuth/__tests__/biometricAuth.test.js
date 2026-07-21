/**
 * @file biometricAuth.test.js
 * @description Unit tests for the biometricAuth Lightning Web Component.
 *
 * TEST PHILOSOPHY
 * ---------------
 * The Median JavaScript bridge (window.median) is a native runtime object
 * injected by the app shell. It is never present in a Jest/jsdom environment.
 * Tests therefore follow two strategies:
 *
 *   1. OUT-OF-APP TESTS (no bridge)
 *      Verify the component degrades gracefully: the warning banner is visible,
 *      all bridge-dependent buttons are disabled, and no bridge methods are called.
 *      These tests run without any setup and represent the default jsdom state.
 *
 *   2. IN-APP TESTS (mocked bridge)
 *      A mock `window.median` object is installed before each test and removed
 *      afterwards. The mock exposes Jest spy functions for every bridge method
 *      the component calls, so we can assert the correct arguments were passed
 *      and simulate both success and failure responses.
 *
 * RUNNING THE TESTS
 * -----------------
 * Prerequisites:
 *   node >= 18
 *   npm install   (installs @salesforce/sfdx-lwc-jest and its dependencies)
 *
 * Commands (run from the repository root):
 *   npm test                  — run all tests once
 *   npm run test:watch        — re-run on file save (useful during development)
 *   npm run test:coverage     — run with coverage report
 *
 * See package.json and jest.config.js at the repository root for configuration.
 *
 * IMPORTANT: These tests verify component logic and DOM behaviour only.
 * They do NOT replace manual testing on a physical device inside the Median app.
 * Always verify biometric flows (save, retrieve, delete) on a real iOS and
 * Android device before merging changes to main.
 */

import { createElement } from '@lwc/engine-dom';
import BiometricAuth from 'c/biometricAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates and mounts a fresh biometricAuth element.
 * The element is appended to document.body so that LWC lifecycle hooks fire.
 * @returns {HTMLElement} The mounted component element.
 */
function createComponent() {
    const element = createElement('c-biometric-auth', { is: BiometricAuth });
    document.body.appendChild(element);
    return element;
}

/**
 * Builds a mock window.median bridge with Jest spy functions for every method
 * the biometricAuth component calls.
 *
 * Each method returns a resolved Promise by default so that async component
 * methods complete without throwing. Individual tests override return values
 * using mockResolvedValueOnce / mockRejectedValueOnce.
 *
 * @returns {Object} Mock bridge object.
 */
function buildMockBridge() {
    return {
        auth: {
            // Returns { hasTouchId: boolean, hasSecret: boolean }
            status: jest.fn().mockResolvedValue({ hasTouchId: true, hasSecret: false }),
            // Resolves with undefined on success (component treats this as OK)
            save:   jest.fn().mockResolvedValue(undefined),
            // Resolves with undefined on success
            delete: jest.fn().mockResolvedValue(undefined),
            // Callback-based: component registers window.median_auth_get_callback
            // and then calls median.auth.get(). We invoke the callback manually
            // in tests to simulate a native response.
            get:    jest.fn()
        }
    };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
    // Reset the DOM between tests. The jsdom instance is shared across all
    // tests in this file, so any elements appended in one test must be removed
    // before the next test runs, otherwise component state leaks between tests.
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }

    // Remove the mock bridge so out-of-app tests see window.median as undefined.
    delete window.median;

    // Clean up any global callbacks registered by the component.
    delete window.median_auth_get_callback;

    // Reset all Jest mocks so spy call counts don't accumulate across tests.
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1: Out-of-app behaviour (no window.median)
// ---------------------------------------------------------------------------

describe('c-biometric-auth — out-of-app (no Median bridge)', () => {

    it('renders the not-in-app warning banner when window.median is absent', async () => {
        // Arrange & Act
        const element = createComponent();
        await Promise.resolve(); // flush LWC rendering microtask queue

        // Assert: the amber warning banner must be visible to inform the user
        // that biometric features are unavailable outside the Median app.
        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('Biometric Auth features are only available');
    });

    it('disables the Check Biometric Status button when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        // The status check requires the bridge; it must be disabled so a user
        // cannot trigger a bridge call that would silently fail.
        const btn = element.shadowRoot.querySelector('lightning-button[label="Check Biometric Status"]');
        expect(btn).not.toBeNull();
        expect(btn.disabled).toBe(true);
    });

    it('disables the Save Secret button when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const btn = element.shadowRoot.querySelector('lightning-button[label="Save Secret (Biometric)"]');
        expect(btn.disabled).toBe(true);
    });

    it('disables the Get Secret via Biometrics button when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const btn = element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]');
        expect(btn.disabled).toBe(true);
    });

    it('disables the Delete Saved Secret button when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const btn = element.shadowRoot.querySelector('lightning-button[label="Delete Saved Secret"]');
        expect(btn.disabled).toBe(true);
    });

    it('shows the empty placeholder in the output box before any retrieval', async () => {
        const element = createComponent();
        await Promise.resolve();

        // The output box placeholder communicates to the user that no secret
        // has been retrieved yet. If this text is missing, the UI is broken.
        const placeholder = element.shadowRoot.querySelector('.output-box.empty');
        expect(placeholder).not.toBeNull();
        expect(placeholder.textContent).toContain('Secret will appear here');
    });

});

// ---------------------------------------------------------------------------
// Suite 2: In-app behaviour (with mocked window.median bridge)
// ---------------------------------------------------------------------------

describe('c-biometric-auth — in-app (with mocked Median bridge)', () => {

    beforeEach(() => {
        // Install the mock bridge before each in-app test.
        window.median = buildMockBridge();
    });

    it('hides the not-in-app warning banner when the bridge is present', async () => {
        const element = createComponent();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        // The banner is rendered with if:false={isInMedianApp} so it should
        // not exist in the DOM when window.median is present.
        expect(banner).toBeNull();
    });

    it('enables bridge-dependent buttons when the bridge is present', async () => {
        const element = createComponent();
        await Promise.resolve();

        const statusBtn = element.shadowRoot.querySelector('lightning-button[label="Check Biometric Status"]');
        const deleteBtn = element.shadowRoot.querySelector('lightning-button[label="Delete Saved Secret"]');
        const getBtn    = element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]');

        expect(statusBtn.disabled).toBe(false);
        expect(deleteBtn.disabled).toBe(false);
        expect(getBtn.disabled).toBe(false);
    });

    it('calls median.auth.status() when Check Biometric Status is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        const btn = element.shadowRoot.querySelector('lightning-button[label="Check Biometric Status"]');
        btn.click();
        await Promise.resolve(); // allow the async checkStatus() method to run

        expect(window.median.auth.status).toHaveBeenCalledTimes(1);
    });

    it('renders biometric status key-values after a successful status check', async () => {
        // Arrange: configure the mock to return a known status object
        window.median.auth.status.mockResolvedValueOnce({ hasTouchId: true, hasSecret: true });

        const element = createComponent();
        await Promise.resolve();

        // Act: click the status button and wait for the async method + re-render
        element.shadowRoot.querySelector('lightning-button[label="Check Biometric Status"]').click();
        await Promise.resolve();
        await Promise.resolve();

        // Assert: the status box with key-value pairs must appear
        const statusBox = element.shadowRoot.querySelector('.biometric-status-box');
        expect(statusBox).not.toBeNull();
        expect(statusBox.textContent).toContain('Has Touch/Face ID');
        expect(statusBox.textContent).toContain('Has Saved Secret');
    });

    it('keeps Save Secret button disabled until both username and password are entered', async () => {
        const element = createComponent();
        await Promise.resolve();

        // With no input, the button should be disabled even when the bridge exists
        const saveBtn = element.shadowRoot.querySelector('lightning-button[label="Save Secret (Biometric)"]');
        expect(saveBtn.disabled).toBe(true);
    });

    it('calls median.auth.save() with a JSON-encoded secret on Save Secret click', async () => {
        // Arrange: status check must pass first (component calls status before saving)
        window.median.auth.status.mockResolvedValue({ hasTouchId: true, hasSecret: false });

        const element = createComponent();
        await Promise.resolve();

        // Simulate user typing a username and password via the input change events.
        // LWC input components fire the 'change' event which the component listens to.
        const usernameInput = element.shadowRoot.querySelector('lightning-input[label="Username"]');
        const passwordInput = element.shadowRoot.querySelector('lightning-input[label="Password / Secret"]');

        usernameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'testuser' } }));
        passwordInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'testpass' } }));
        await Promise.resolve();

        // Act
        element.shadowRoot.querySelector('lightning-button[label="Save Secret (Biometric)"]').click();
        await Promise.resolve();
        await Promise.resolve();

        // Assert: save was called with a JSON string containing the credentials
        expect(window.median.auth.save).toHaveBeenCalledTimes(1);
        const callArgs = window.median.auth.save.mock.calls[0][0];
        expect(callArgs).toHaveProperty('secret');
        const parsed = JSON.parse(callArgs.secret);
        expect(parsed.username).toBe('testuser');
        expect(parsed.password).toBe('testpass');
    });

    it('does not call median.auth.save() when the device has no biometrics', async () => {
        // Arrange: device reports no Touch/Face ID
        window.median.auth.status.mockResolvedValue({ hasTouchId: false, hasSecret: false });

        const element = createComponent();
        await Promise.resolve();

        const usernameInput = element.shadowRoot.querySelector('lightning-input[label="Username"]');
        const passwordInput = element.shadowRoot.querySelector('lightning-input[label="Password / Secret"]');
        usernameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'user' } }));
        passwordInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'pass' } }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Save Secret (Biometric)"]').click();
        await Promise.resolve();
        await Promise.resolve();

        // The component must abort before calling save when biometrics are unavailable
        expect(window.median.auth.save).not.toHaveBeenCalled();
    });

    it('calls median.auth.delete() when Delete Saved Secret is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Delete Saved Secret"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.median.auth.delete).toHaveBeenCalledTimes(1);
    });

    it('registers the global callback and calls median.auth.get() on Get Secret click', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]').click();
        await Promise.resolve();

        // The component must register a named callback on window BEFORE calling get()
        // so the native layer knows where to send the result.
        expect(typeof window.median_auth_get_callback).toBe('function');
        expect(window.median.auth.get).toHaveBeenCalledTimes(1);
        expect(window.median.auth.get.mock.calls[0][0]).toMatchObject({
            callbackFunction: 'median_auth_get_callback'
        });
    });

    it('renders the retrieved secret in the output box when the callback fires with success', async () => {
        const element = createComponent();
        await Promise.resolve();

        // Trigger the get flow so the global callback is registered
        element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]').click();
        await Promise.resolve();

        // Simulate the native layer invoking the callback with a successful result.
        // The secret is a JSON string matching the format written by saveSecret().
        const mockSecret = JSON.stringify({ username: 'testuser', password: 'testpass' });
        window.median_auth_get_callback({ success: true, secret: mockSecret });
        await Promise.resolve();
        await Promise.resolve();

        // The output box should now contain the formatted secret
        const outputBox = element.shadowRoot.querySelector('textarea.output-box');
        expect(outputBox).not.toBeNull();
        expect(outputBox.value).toContain('testuser');
    });

    it('shows an error status badge when the biometric callback fires with failure', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]').click();
        await Promise.resolve();

        // Simulate authentication failure (e.g. user cancelled the Face ID prompt)
        window.median_auth_get_callback({ success: false, error: 'authenticationFailed' });
        await Promise.resolve();
        await Promise.resolve();

        // The output box must remain empty; the status badge must reflect failure
        const outputBox = element.shadowRoot.querySelector('textarea.output-box');
        expect(outputBox).toBeNull(); // textarea is only rendered when there is content

        const statusBadge = element.shadowRoot.querySelector('.badge-error');
        expect(statusBadge).not.toBeNull();
    });

    it('clears the output box and status when Clear Output is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        // First retrieve a secret so there is something to clear
        element.shadowRoot.querySelector('lightning-button[label="Get Secret via Biometrics"]').click();
        await Promise.resolve();
        window.median_auth_get_callback({ success: true, secret: JSON.stringify({ username: 'u', password: 'p' }) });
        await Promise.resolve();
        await Promise.resolve();

        // Act: click Clear Output
        element.shadowRoot.querySelector('lightning-button[label="Clear Output"]').click();
        await Promise.resolve();

        // Assert: textarea gone, placeholder visible again
        const outputBox  = element.shadowRoot.querySelector('textarea.output-box');
        const placeholder = element.shadowRoot.querySelector('.output-box.empty');
        expect(outputBox).toBeNull();
        expect(placeholder).not.toBeNull();
    });

});