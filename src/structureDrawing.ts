/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import SmilesDrawer from "smiles-drawer";

/**
 *  Draws the chemical structure of a given element using the embedded SMILES.
 */
export function drawStructure(this: HTMLElement): void {
    const canvas: HTMLCanvasElement = this as HTMLCanvasElement;
    const options = {
        experimentalSSSR: true,
        height: 200,
        padding: 30,
        width: ($(canvas).parent().width() || 270) - 20,
    };
    // SmilesDrawer can't cope with drawing while hidden, so display
    // the element if it's hidden, draw it, then hide it again.
    // Since the depth isn't known, move it to the body,
    // then back to the beginning of the parent element
    const parent: JQuery<HTMLElement> = $(canvas).parent();
    const visible: boolean = $(canvas).is(":visible");
    if (!visible) {
        parent.detach(canvas.id);
        $("body").append(canvas);
    }
    const smilesDrawer = new SmilesDrawer.Drawer(options);
    SmilesDrawer.parse(canvas.getAttribute("data-smiles"),
                       (tree: string) => smilesDrawer.draw(tree, canvas, "light", false));
    if (!visible) {
        parent.prepend(canvas);
    }
    $(this).click(function(this: HTMLElement, event: JQuery.Event) {
        $(`#${$(this).attr("id")}-modal`).show();
        const target = $(`#${$(this).attr("id")}-modal`).children(".modal-content").children(".smiles-canvas-modal").first();
        if (typeof(target) === "undefined") {
            return;
        }
        const modalOptions = {
            experimentalSSSR: true,
            height: (target.height() || 500),
            padding: 30,
            width: ((target.width() || 700) + 80),  // unintuitive, but forces fitting into element
        };
        // again, expand it first
        const modalExpanded: boolean = target.parent().parent().hasClass("expanded");
        if (!modalExpanded) {
            target.parent().css("display", "block");
        }
        const modalSmilesDrawer = new SmilesDrawer.Drawer(modalOptions);
        const modalCanvas: HTMLCanvasElement = target[0] as HTMLCanvasElement;
        SmilesDrawer.parse(modalCanvas.getAttribute("data-smiles"),
                           (tree: string) => modalSmilesDrawer.draw(tree, modalCanvas, "light", false));
        if (!modalExpanded) {
            $(target).parent().removeAttr("style");
        }
        $(`#${$(this).attr("id")}-modal`).children(".modal-content")
            .css("top", `${$(this).position().top - modalOptions.height / 2}px`);
    });
}

/**
 *  Draws the chemical structure of all matching elements.
 */
export function drawStructures(): void {
  $(".smiles-canvas").each(drawStructure);
  $(".modal-container").off("click").click(() => $(".modal-container").hide());
}
