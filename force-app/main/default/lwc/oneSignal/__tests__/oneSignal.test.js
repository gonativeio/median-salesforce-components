/**
 * @file oneSignal.test.js
 * @description Unit tests for the oneSignal Lightning Web Component.
 *
 * TEST PHILOSOPHY
 * ---------------
 * See biometricAuth.test.js for full documentation on the testing approach,
 * the two-strategy pattern (out-of-app vs in-app), and how to run the suite.
 *
 * OneSignal-specific notes:
 *
 *   - median.onesignal.info() supports TWO invocation patterns:
 *       1. Promise — component calls info() and awaits the result.
 *       2. Callback — component registers window.median_onesignal_info and
 *          passes { callback: 'median_onesignal_info' } to info(). The native
 *          layer then calls the global function directly.
 *     Both patterns are tested here.
 *
 *   - median.onesignal.login(externalUserId) associates the device with a
 *     Salesforce user. The Login button must be disabled until the external
 *     user ID field contains a non-empty value.
 *
 *   - median.onesignal.logout() removes the external ID association. It does
 *     NOT unsubscribe the device from push notifications.
 *
 * RUNNING THE TESTS
 * -----------------
 *   npm install          (from the repository root)
 *   npm test             — run once
 *   npm run test:watch   — watch mode
 */

import { createElement } from '@lwc/engine-dom';
import OneSignal from 'c/oneSignal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createComponent() {
    const element = createElement('c-one-signal', { is: OneSignal });
    document.body.appendChild(element);
    return element;
}

/**
 * Builds a mock window.median bridge covering every OneSignal method the
 * component calls. Resolved values match the shape documented in the Median
 * OneSignal plugin reference.
 */
function buildMockBridge() {
    return {
        onesignal: {
            // Returns the OneSignal subscription info object.
            // Shape: { userId, pushToken, isPushDisabled, isSubscribed, ... }
            info: jest.fn().mockResolvedValue({
                userId: 'mock-player-id-123',
                pushToken: 'mock-push-token-abc',
                isPushDisabled: false,
                isSubscribed: true
            }),
            // login(externalUserId) — resolves with { success: true } on success
            login: jest.fn().mockResolvedValue({ success: true }),
            // logout() — resolves with undefined on success
            logout: jest.fn().mockResolvedValue(undefined)
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
    delete window.median_onesignal_info;
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1: Out-of-app behaviour
// ---------------------------------------------------------------------------

describe('c-one-signal — out-of-app (no Median bridge)', () => {

    it('renders the not-in-app warning banner when window.median is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        expect(banner).not.toBeNull();
    });

    it('disables bridge-dependent buttons when the bridge is absent', async () => {
        const element = createComponent();
        await Promise.resolve();

        // All three action buttons rely on the bridge
        const promiseBtn  = element.shadowRoot.querySelector('lightning-button[label="Get Info (Promise)"]');
        const callbackBtn = element.shadowRoot.querySelector('lightning-button[label="Get Info (Callback)"]');
        const loginBtn    = element.shadowRoot.querySelector('lightning-button[label="Login User"]');
        const logoutBtn   = element.shadowRoot.querySelector('lightning-button[label="Logout User"]');

        expect(promiseBtn.disabled).toBe(true);
        expect(callbackBtn.disabled).toBe(true);
        expect(loginBtn.disabled).toBe(true);
        expect(logoutBtn.disabled).toBe(true);
    });

    it('does not render the info box when no data has been received', async () => {
        const element = createComponent();
        await Promise.resolve();

        // The info display panel should not exist before any bridge call is made
        const infoBox = element.shadowRoot.querySelector('.info-box');
        expect(infoBox).toBeNull();
    });

});

// ---------------------------------------------------------------------------
// Suite 2: In-app behaviour (Promise pattern)
// ---------------------------------------------------------------------------

describe('c-one-signal — in-app, Get Info via Promise', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('hides the warning banner when the bridge is present', async () => {
        const element = createComponent();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.not-in-app-banner');
        expect(banner).toBeNull();
    });

    it('calls median.onesignal.info() when Get Info (Promise) is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Info (Promise)"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.median.onesignal.info).toHaveBeenCalledTimes(1);
        // Promise variant is called with no arguments
        expect(window.median.onesignal.info).toHaveBeenCalledWith();
    });

    it('renders the info box with the returned data after a successful Promise call', async () => {
        window.median.onesignal.info.mockResolvedValueOnce({
            userId: 'player-xyz',
            isSubscribed: true
        });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Info (Promise)"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const infoBox = element.shadowRoot.querySelector('.info-box');
        expect(infoBox).not.toBeNull();
        expect(infoBox.textContent).toContain('player-xyz');
    });

    it('clears the info box when the Clear button is clicked', async () => {
        window.median.onesignal.info.mockResolvedValueOnce({ userId: 'u1' });

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Info (Promise)"]').click();
        await Promise.resolve();
        await Promise.resolve();

        // Info box should now exist
        expect(element.shadowRoot.querySelector('.info-box')).not.toBeNull();

        // Click Clear
        element.shadowRoot.querySelector('lightning-button[label="Clear"]').click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.info-box')).toBeNull();
    });

});

// ---------------------------------------------------------------------------
// Suite 3: In-app behaviour (Callback pattern)
// ---------------------------------------------------------------------------

describe('c-one-signal — in-app, Get Info via Callback', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('registers the global callback and passes its name to info() on callback click', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Info (Callback)"]').click();
        await Promise.resolve();

        // The component must register the global function BEFORE calling info()
        expect(typeof window.median_onesignal_info).toBe('function');
        expect(window.median.onesignal.info).toHaveBeenCalledWith(
            expect.objectContaining({ callback: 'median_onesignal_info' })
        );
    });

    it('renders the info box when the native layer invokes the global callback', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Get Info (Callback)"]').click();
        await Promise.resolve();

        // Simulate the native layer calling the registered global function
        window.median_onesignal_info({ userId: 'callback-player-id', isSubscribed: true });
        await Promise.resolve();
        await Promise.resolve();

        const infoBox = element.shadowRoot.querySelector('.info-box');
        expect(infoBox).not.toBeNull();
        expect(infoBox.textContent).toContain('callback-player-id');
    });

});

// ---------------------------------------------------------------------------
// Suite 4: User login and logout
// ---------------------------------------------------------------------------

describe('c-one-signal — in-app, User Management', () => {

    beforeEach(() => {
        window.median = buildMockBridge();
    });

    it('keeps the Login User button disabled when the external ID field is empty', async () => {
        const element = createComponent();
        await Promise.resolve();

        // Even with the bridge present, login requires a non-empty external ID
        const loginBtn = element.shadowRoot.querySelector('lightning-button[label="Login User"]');
        expect(loginBtn.disabled).toBe(true);
    });

    it('enables Login User after a non-empty external ID is entered', async () => {
        const element = createComponent();
        await Promise.resolve();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new CustomEvent('change', { detail: { value: 'user@example.com' } }));
        await Promise.resolve();

        const loginBtn = element.shadowRoot.querySelector('lightning-button[label="Login User"]');
        expect(loginBtn.disabled).toBe(false);
    });

    it('calls median.onesignal.login() with the entered external ID', async () => {
        const element = createComponent();
        await Promise.resolve();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new CustomEvent('change', { detail: { value: 'user@example.com' } }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Login User"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.median.onesignal.login).toHaveBeenCalledWith('user@example.com');
    });

    it('shows a success badge after a successful login', async () => {
        window.median.onesignal.login.mockResolvedValueOnce({ success: true });

        const element = createComponent();
        await Promise.resolve();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new CustomEvent('change', { detail: { value: 'user@example.com' } }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Login User"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-success, .status-badge.success');
        expect(badge).not.toBeNull();
    });

    it('shows an error badge when login returns { success: false }', async () => {
        window.median.onesignal.login.mockResolvedValueOnce({ success: false });

        const element = createComponent();
        await Promise.resolve();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new CustomEvent('change', { detail: { value: 'user@example.com' } }));
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Login User"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-error, .status-badge.error');
        expect(badge).not.toBeNull();
    });

    it('calls median.onesignal.logout() when Logout User is clicked', async () => {
        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Logout User"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.median.onesignal.logout).toHaveBeenCalledTimes(1);
    });

    it('shows a success badge after a successful logout', async () => {
        window.median.onesignal.logout.mockResolvedValueOnce(undefined);

        const element = createComponent();
        await Promise.resolve();

        element.shadowRoot.querySelector('lightning-button[label="Logout User"]').click();
        await Promise.resolve();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector('.badge-success, .status-badge.success');
        expect(badge).not.toBeNull();
    });

});