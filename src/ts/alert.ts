/**
 * @license CDDL-1.0
 *
 * @copyright
 * Based on https://github.com/PaulNieuwelaar/alertjs
 * Alert.js v2.1 - Paul Nieuwelaar Magnetism 2016
 *  
 * Changes from original version:
 * - Migrated to TypeScript
 * - Type definitions added to use it in other bundles
 * - Styles and images bundled into output JS using Webpack
 * - Some method parameters removed, due to bundling, some were reordered
 * - Prepared for NPM package publishing
 *
 * 2019 - Anton Zhaparov
 */

import css from "../css/alert.css";


export interface ContentFrame extends Window {
    getResponse(): object;
}

export interface Button {
    label: string;
    callback?: () => void;
    setFocus?: boolean;
    preventClose?: boolean;
    internalId?: string;
}


export type ButtonList = Button[];

export type IconType = "INFO" | "WARNING" | "ERROR" | "SUCCESS" | "QUESTION" | "LOADING" | "NONE";

export type Nullable<T> = T | undefined;


class AlertManager {
    private readonly iconTypeToClassMap = {
        ERROR: "crit",
        WARNING: "warn",
        INFO: "info",
        SUCCESS: "tick",
        QUESTION: "ques",
        LOADING: "load",
        NONE: null
    };


    private isInitialised = false;
    private crmContext!: Window;
    private context!: Document;
    private jQuery!: JQueryStatic;

    // purpose: display an alert style dialog for the user using a styled CRM lightbox
    // Allows for custom buttons and callbacks
    // title = Main big message
    // message = (optional) Sub-heading shown below the title
    // icon = (optional, defaults to none) Displays a custom icon on the alert: INFO, WARNING, ERROR, SUCCESS, QUESTION, LOADING
    // buttons = (otional, defaults to 'Ok') Array of buttons and callback functions for each button. Callbacks optional. E.g. [{label: "OK", callback: function(){}},{label: "Cancel"}]
    // width = (optional, defaults to 500) Custom width of the dialog
    // height = (optional, defaults to 250) Custom height of the dialog
    // padding = (optional, defaults to 20) Sets the amount of padding around the light-box. Set to 0 for no padding (on iframes etc)
    // preventCancel = (optional, defaults to false) Hides the 'X' in the top right corner, meaning you can only dismiss the alert using the buttons
    public show(
        title = "",
        message = "",
        buttons: ButtonList = [{ label: "OK" }],
        icon: IconType = "NONE",
        preventCancel = false,
        width = 500,
        height = 250,
        padding = 20
    ): void {
        if (!this.isInitialised) {
            // The CRM window, for calling back from an Alert iframe. Use parent.Alert._crmContext to get back to the CRM window from inside an iframe
            this.crmContext = window;

            this.jQuery = window.jQuery || window.parent.jQuery || window.top.jQuery;

            // The parent/top document which we append the wrapper to
            this.context = window.top.document;

            window.top.Alert = this;

            // The wrapper sits outside the form, so it may exist even if Alert.js is not initialised
            const $alertJsWrapper = this.$("#alertJs-wrapper");
            if ($alertJsWrapper == null || $alertJsWrapper.length === 0) {
                const alertJsHtml =
                    "<style>" + css + "</style>" +
                    "<div id='alertJs-wrapper' class='alert-js-wrapper'>" +
                    "<div class='alert-js-background'></div>" +
                    "<div id='alertJs-dialog' class='alert-js-dialog'>" +
                    "<div class='alert-js-RefreshDialog-Warning' id='alertJs-divWarning'>" +
                    "<table class='alert-js-table-wrapper' cellspacing='0' cellpadding='0'>" +
                    "<tr id='alertJs-errorRow'>" +
                    "<td id='alertJs-imageWrapper' class='alert-js-image-td alert-js-td'>" +
                    "<div id='alertJs-image' class='alert-js-image'></div>" +
                    "</td>" +
                    "<td class='alert-js-td'>" +
                    "<div class='alert-js-Error-Header ms-crm-Field-Data-Print' id='alertJs-title'></div>" +
                    "<div class='alert-js-Error-Message ms-crm-Field-Data-Print' id='alertJs-message'></div>" +
                    "</td>" +
                    "</tr>" +
                    "</table>" +
                    "</div>" +
                    "<div class='alert-js-RefreshDialog-Footer' id='alertJs-tdDialogFooter'></div>" +
                    "<div id='alertJs-closeWrapper' class='alert-js-close-wrapper'>" +
                    "<div id='alertJs-close' class='alert-js-close' title='Cancel'></div>" +
                    "</div>" +
                    "</div>" +
                    "</div>";

                this.$("body").append(alertJsHtml);
            }

            // Attach close event (messes up with jquery)
            const $closeButton = this.$<HTMLButtonElement>("#alertJs-close");
            if ($closeButton != null) {
                $closeButton.click(() => this.hide());
            }

            this.isInitialised = true;
        }

        // Update the title and message
        this.$("#alertJs-title").html(title);
        this.$("#alertJs-message").html(message);

        // Hide title if not specified
        if (title === "") {
            this.$("#alertJs-title").hide();
        }
        else {
            this.$("#alertJs-title").show();
        }

        // Hide message if not specified
        if (message === "") {
            this.$("#alertJs-message").hide();
        }
        else {
            this.$("#alertJs-message").show();
        }

        // Add the icon
        if (icon == null || this.iconTypeToClassMap[icon] == null) {
            // Hide icon if not specified
            this.$("#alertJs-imageWrapper").hide();
        }
        else {
            this.$("#alertJs-imageWrapper").show();

            // Remove any existing image classes before adding the new one
            this.$("#alertJs-image")
                .removeClass("alert-js-image-crit alert-js-image-warn alert-js-image-info alert-js-image-tick alert-js-image-ques alert-js-image-load")
                .addClass("alert-js-image-" + this.iconTypeToClassMap[icon]);
        }

        // Delete existing buttons
        this.$("#alertJs-tdDialogFooter").empty();

        // Create new buttons
        for (const button of buttons) {
            const $button = this.$<HTMLButtonElement>("<button>", { tabindex: "1", type: "button" });
            $button.addClass("alert-js-RefreshDialog-Button");

            // Set focus to the button if explicitly specified, or if only one button
            if ((buttons.length === 1 && button.setFocus !== false) || button.setFocus === true) {
                $button.addClass("alert-js-RefreshDialog-Button-focus");
            }

            $button.html(button.label);

            // Set internal id to manipulate buttons
            if (button.internalId != null) {
                $button.attr("id", "alertJs-Button-" + button.internalId);
            }

            $button.click(() => this.buttonClicked(button.callback, button.preventClose));

            this.$("#alertJs-tdDialogFooter").append($button);
        }

        if (buttons.length > 0) {
            // Show the buttons bar
            this.$("#alertJs-divWarning").removeClass("alert-js-maxHeight");
            this.$("#alertJs-tdDialogFooter").show();
        }
        else {
            // Hide the buttons bar
            this.$("#alertJs-divWarning").addClass("alert-js-maxHeight");
            this.$("#alertJs-tdDialogFooter").hide();
        }

        // Show or hide the manual cancel button
        if (preventCancel) {
            this.$("#alertJs-closeWrapper").hide();
        }
        else {
            this.$("#alertJs-closeWrapper").show();
        }

        // Makes the formatting nicer if the popup is huge (for displaying trace logs etc)
        if (height > 250) {
            this.$(".alert-js-td").addClass("alert-js-td-top");
        }
        else {
            this.$(".alert-js-td").removeClass("alert-js-td-top");
        }

        // Set height/width of the alert
        this.$("#alertJs-dialog").css("height", height).css("width", width).css("margin-top", height * -0.5).css("margin-left", width * -0.5);

        // Set the height of the message body, to allow it to use the max space if buttons are hidden, or title is hidden, and allows scrollbar
        this.$("#alertJs-message").css("max-height", this.calculateMessageHeight(height, padding, buttons.length, title));

        // Set the padding of the light-box
        this.$(".alert-js-RefreshDialog-Warning").css("left", padding).css("right", padding);
        this.$(".alert-js-td").css("padding-top", padding).css("padding-bottom", padding);

        // Show the alert wrapper
        this.$("#alertJs-wrapper").show();

        // Set focus to the button(s) if applicable
        this.$(".alert-js-RefreshDialog-Button-focus").focus();
    }

    public showIFrame(
        iframeUrl: string,
        width = 800,
        height = 600,
        padding = 0,
        title?: string,
        buttons: ButtonList = [],
        preventCancel?: boolean
    ): void {
        const iframeHtml = "<iframe id='alertJs-iFrame' class='alert-js-iframe' src='" + this.htmlEncode(iframeUrl) + "'></iframe>";

        this.show(title, iframeHtml, buttons, "NONE", preventCancel, width, height, padding);

        // Set a fixed height on the iframe (minus 3 for some reason) - it doesn't like relative heights, i.e. calc(100% - 4)
        // fixed to 4 for Chrome
        this.$("#alertJs-iFrame").css("height", this.calculateMessageHeight(height, padding, buttons.length, title) - 4);
    }

    public showWebResource(
        webResourceName: string,
        title?: string,
        buttons?: ButtonList,
        preventCancel = false,
        width?: number,
        height?: number,
        padding?: number,
        baseUrl: string = Xrm.Utility.getGlobalContext().getClientUrl(),
    ): void {
        const iframeUrl = baseUrl + "/webresources/" + webResourceName;

        this.showIFrame(iframeUrl, width, height, padding, title, buttons, preventCancel);
    }

    public showDialogProcess(
        dialogId: string,
        entityName: string,
        recordId: string,
        callback?: () => void,
        width?: number,
        height?: number,
        baseUrl: string = Xrm.Utility.getGlobalContext().getClientUrl()
    ): void {
        const dialogUrl = baseUrl + "/cs/dialog/rundialog.aspx?DialogId=%7b" + dialogId + "%7d&EntityName=" + entityName + "&ObjectId=" + recordId;

        this.showIFrame(dialogUrl, width, height);

        // Handle the callback and close actions (otherwise it tries to close the whole form, rather than the popup)
        const $frame = this.$<HTMLIFrameElement>("#alertJs-iFrame");
        $frame.on("load", () => {
            try {
                // Override the CRM close Window function (unsupported)
                const frameDoc = $frame[0].contentWindow;
                if (frameDoc != null) {
                    frameDoc.closeWindow = (): void => {
                        // Fire the callback and close
                        if (callback) {
                            callback();
                        }

                        this.hide();
                    };
                }
            }
            catch (e) { }
        });
    }

    public showLoading(): void {
        this.show("Loading...", "", [], "LOADING", true, 230, 115);
    }

    // Hide the alert manually without performing any callbacks
    public hide(subgridCall = false): void {
        if (subgridCall) {
            window.top.jQuery("#alertJs-wrapper").hide();
            return;
        }

        if (this.isInitialised) {
            this.$("#alertJs-wrapper").hide();
        }
    }

    // Encode the Title or Message to display xml tags, e.g. from a plugin error trace
    // Also replaces javascript line breaks with <br>
    public htmlEncode(text: string): string {
        if (text == null) {
            return text;
        }

        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/\s{2}/g, "&nbsp;&nbsp;")
            .replace(/\n/g, "<br />");
    }

    // Get the CRM window from inside an iframe to access custom functions, e.g. parent.Alert.getCrmWindow().doSomething();
    public getCrmWindow(): Nullable<Window> {
        return this.crmContext;
    }

    public setButtonEnabled(
        internalId: string,
        isEnabled: boolean,
        childCall: boolean
    ): void {
        if (internalId == null) {
            throw new Error("internalId parameter is not specified.");
        }

        const button = childCall ? parent.jQuery("#alertJs-Button-" + internalId) : this.$("#alertJs-Button-" + internalId);
        button.prop("disabled", !isEnabled);
    }

    // Use the returned iframe context with jQuery to get data from the iframe, i.e. this.$("#something", Alert.getIFrameContext().document);
    public getIFrameWindow(subgridCall = false): Nullable<ContentFrame> {
        let iFrameContext: Nullable<ContentFrame>;

        if (this.isInitialised) {
            const $iFrame = subgridCall ? window.top.jQuery("#alertJs-iFrame") : this.$<HTMLIFrameElement>("#alertJs-iFrame");

            if ($iFrame.length > 0) {
                try {
                    iFrameContext = $iFrame[0].contentWindow;
                }
                catch (e) { }
            }
        }

        return iFrameContext;
    }

    public getIFrameResponse(subgridCall = false): Nullable<object> {
        const iFrame = this.getIFrameWindow(subgridCall);

        if (iFrame == null) {
            return;
        }

        return iFrame.getResponse();
    }


    // Custom jQuery wrapper to use jquery from the parent CRM page to access elements from the top page where Alertjs is
    private $<TElement extends HTMLElement = HTMLElement>(selector: JQuery.htmlString, params?: Document | JQuery.PlainObject): JQuery<TElement> {
        return this.jQuery<TElement>(selector, params || this.context);
    }

    // Calculates the height of the sub-heading/message based on other variables
    private calculateMessageHeight(dialogHeight: number, dialogPadding: number, buttonLength: number, title?: string): number {
        return dialogHeight - (dialogPadding * 2) - (buttonLength > 0 ? 44 : 0) - (title != null && title !== "" ? 32 : 0);
    }

    // Internal button click event
    private buttonClicked(callback?: () => void, preventClose?: boolean): void {
        this.$(".alert-js-RefreshDialog-Button").prop("disabled", true);

        try {
            // Unless specified, close the alert after executing the callback
            if (preventClose !== true) {
                this.hide();
            }

            // Calls the callback function (after closing the previous alert in case we show another alert)
            if (callback != null) {
                callback();
            }
        }
        catch (e) {
            alert(e);
        }

        this.$(".alert-js-RefreshDialog-Button").prop("disabled", false);
    }
}

export const Alert = new AlertManager();
