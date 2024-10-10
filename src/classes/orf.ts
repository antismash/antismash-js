/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {IOrf} from "./pythonStructures.js";
import {Transform} from "./transform.js";

export class Orf {
    public readonly start: number;
    public readonly end: number;
    public readonly strand: number;
    public readonly type: string;
    public readonly description: string;
    public readonly locusTag: string;
    public readonly product: string;
    public readonly translation: string;
    public readonly dna: string;
    public readonly resistance?: boolean;
    public readonly color?: string;
    public readonly group?: number;
    public otherSide?: Orf;
    public transform: Transform;

    constructor(source: IOrf) {
        this.start = source.start;
        this.end = source.end;
        this.strand = source.strand;
        this.type = source.type;
        this.description = source.description;
        this.locusTag = source.locus_tag;
        this.product = source.product;
        this.translation = source.translation;
        this.dna = source.dna;
        this.resistance = source.resistance;
        this.color = source.color;
        this.group = source.group;
        this.transform = new Transform(0, 0, 0, 0);
    }

    public getLocus() {
        // a cross-origin gene in a full-contig region that's been split
        // should consistently use the pre-origin section's name
        if (this.isSplit() && this.otherSide !== undefined && this.start === 1) {
            return this.otherSide.locusTag;
        }
        return this.locusTag;
    }

    public isSplit() {
        return this.otherSide !== undefined;
    }
}
