/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

const PREFIX = {
    svg: "http://www.w3.org/2000/svg",
    xlink: "http://www.w3.org/1999/xlink",
    xmlns: "http://www.w3.org/2000/xmlns/",
};

export const initDownloadButtons = (): void => {
    const buttons = document.querySelectorAll(".download-svg");
    buttons.forEach((button) => {
        button.removeEventListener("click", downloadSvgListener, false);
        button.addEventListener("click", downloadSvgListener, false);
    });
};

function downloadSvgListener(event: Event): boolean {
    if (!event.target) {
        // Something is odd here, allow the event to bubble up.
        return true;
    }
    const button = event.target as HTMLElement;
    const tagId = button.getAttribute("data-tag");
    const filename = button.getAttribute("data-filename");
    if (!tagId || !filename) {
        return false;
    }
    downloadSvg(tagId, filename);
    return false;
}

export const downloadSvg = (id: string, filename: string): void => {
    const svgContainer = document.querySelector(`#${id}`);
    if (!svgContainer) {
        return;
    }

    let origSvg: Element | null;

    if (svgContainer.nodeName === "svg") {
        origSvg = svgContainer;
    } else {
        origSvg = svgContainer.children.item(0);
    }
    if (!origSvg || origSvg.nodeName !== "svg") {
        return;
    }

    const svg = origSvg.cloneNode(true);

    fixupSvg(svg as SVGElement);

    const source = new XMLSerializer().serializeToString(svg);
    const data = `data:image/svg+xml;base64,${btoa(source)}`;

    const a = document.createElement("a");
    a.href = data;
    a.download = filename;

    const clickHandler = (event: Event) => {
        setTimeout(() => {
            event?.target?.removeEventListener("click", clickHandler);
        }, 200);
    };

    a.addEventListener("click", clickHandler, false);

    a.click();
};

function fixupSvg(svg: SVGElement): void {
    if (!svg.hasAttribute("version")) {
        svg.setAttribute("version", "1.1");
    }
    if (!svg.hasAttributeNS(PREFIX.xmlns, "xmlns")) {
        svg.setAttributeNS(PREFIX.xmlns, "xmlns", PREFIX.svg);
    }
    if (!svg.hasAttributeNS(PREFIX.xmlns, "xmlns:xlink")) {
        svg.setAttributeNS(PREFIX.xmlns, "xmlns:xlink", PREFIX.xlink);
    }
    document.body.appendChild(svg);
    styleSvg(svg);
    document.body.removeChild(svg);
}

function setStyle(element: Element, emptySVGStyle: Map<string, any>): void {
    const computedStyle = getComputedStyle(element);
    let styleString = "";
    for (let i = 0, len = computedStyle.length; i < len; i++) {
        const key = computedStyle[i];
        const value = computedStyle.getPropertyValue(key);

        // ignore all interaction cues, since this is now non-interactive
        if (key === "cursor") {
            continue;
        }

        // Only set non-default styles
        if (value !== emptySVGStyle.get(key)) {
            styleString += `${key}:${value};`;
        }
    }
    element.setAttribute("style", styleString);
}

function walkTree(node: Element, tree: Element[]): void {
    if (!node?.hasChildNodes()) {
        return;
    }
    let child = node.firstChild;
    while (child) {
        if (child.nodeType === Node.ELEMENT_NODE && child.nodeName !== "SCRIPT") {
            tree.push(child as Element);
            walkTree(child as Element, tree);
        }
        child = child.nextSibling;
    }

}

function initTree(element: Element): Element[] {
    const tree: Element[] = [];
    tree.push(element);
    walkTree(element, tree);
    return tree;
}

function styleSvg(element: SVGElement): void {
    const emptySVG = document.createElementNS(PREFIX.svg, "svg");
    document.body.appendChild(emptySVG);
    // the object from "getComputedStyle" clears after the element is removed
    // from the document, so a copy needs to be made
    const emptySVGStyle = new Map<string, any>();
    const temporaryStyle = getComputedStyle(emptySVG);
    Object.values(temporaryStyle).forEach((key) => {
        emptySVGStyle.set(key, temporaryStyle.getPropertyValue(key));
    });
    document.body.removeChild(emptySVG);

    const allElements = initTree(element);
    let i = allElements.length;
    while (i--) {
        setStyle(allElements[i], emptySVGStyle);
    }
    // respect the zoom, if present, by correcting any width that's present (e.g. "100%")
    // start with the attributes
    element.removeAttribute("width");
    element.removeAttribute("height");
    // then CSS properties that dictate size
    element.style.removeProperty("width");
    element.style.removeProperty("height");
    element.style.removeProperty("inline-size");
    // then grab the viewbox, if it exists, and change any ...
    const viewBox = element.getAttribute("viewbox");
    if (viewBox && viewBox.split(" ").length > 3) {  // ensures it exists and is properly formatted
        element.setAttribute("width", viewBox.split(" ")[2]);
    }
}
