/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {IOrf, IRegion} from "./dataStructures.js";

const LOCUS_ATTRIBUTE = "data-locus";
const WILDCARD_CLASS = "wildcard-container";
const WILDCARD_ATTRIBUTE = "data-wildcard-attrs";
const WILDCARD_PATTERN = /@![^!]*!@/g;

/**
 * Replaces all wildcards in the given text.
 *
 * @remarks
 * All replacement targets must use the {@link WILDCARD_PATTERN | expected pattern}
 * to mark substitution targets, and all targets must be contained by {@link IOrf}.
 *
 * @param text - the text to fill in
 * @param orf - the ORF data to use in replacements
 */

export function replaceWildcardsInText(text: string, orf: IOrf) {
    for (const hit of text.match(WILDCARD_PATTERN) || []) {
        const value: string = (orf[hit.substring(2, hit.length - 2) as (keyof IOrf)] || "").toString();
        text = text.replace(hit, value);
    }
    return text;
}

/**
 * Replaces all wildcards in relevant elements within the given element.
 *
 * @remarks
 * Each {@link WILDCARD_CLASS | relevant child element} must have two attributes:
 * - one for the ORF's locus tag: see {@link LOCUS_ATTRIBUTE}
 * - one with a space separated list of other attributes to check: see {@link WILDCARD_ATTRIBUTE}
 *
 * All attributes to replace wildcards in must use the {@link WILDCARD_PATTERN | expected pattern}
 * to mark substitution targets, and all targets must be contained by {@link IOrf}.
 *
 * @param parent - the parent element to search in
 * @param region - the region data to use in substitutions
 */
export function replaceWildcards(parent: HTMLElement, region: IRegion) {
    $(parent).find(`.${WILDCARD_CLASS}`).each(function(this: HTMLElement) {
        this.classList.remove(WILDCARD_CLASS);
        const locus = this.getAttribute(LOCUS_ATTRIBUTE);
        if (locus === undefined) {
            return;
        }
        const orf = region.orfs.filter((o) => o.locus_tag === locus)[0];
        for (const attr of (this.getAttribute(WILDCARD_ATTRIBUTE) || "").split(" ")) {
            const content = this.getAttribute(attr);
            if (!content) {
                continue;
            }
            this.setAttribute(attr, replaceWildcardsInText(content, orf));
        }
    });
}
