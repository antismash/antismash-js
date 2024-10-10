/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

export interface IBaseDomain {
    readonly html_class: string;
    readonly translation: string;
    readonly start: number;
    readonly end: number;
}

export interface IDomain extends IBaseDomain {  // maps to antismash.common.json.JSONDomain
    readonly type: string;
    readonly predictions: string[];
    readonly napdoslink: string;
    readonly blastlink: string;
    readonly sequence: string;
    readonly identifier: string;
    readonly dna_sequence: string;
    readonly abbreviation: string;
}

export interface IHmmerDomain extends IBaseDomain {
    readonly name: string;
    readonly description: string;
    readonly accession: string;
    readonly evalue: string;
    readonly score: string;
    readonly go_terms?: string[];
}

export interface IOrf {
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly type: string;
    readonly description: string;
    readonly locus_tag: string;
    readonly product: string;
    readonly translation: string;
    readonly dna: string;
    readonly resistance?: boolean;
    readonly color?: string;
    readonly group?: number;
}

export interface IModule {
    readonly start: number;
    readonly end: number;
    readonly complete: boolean;
    readonly monomer: string;
    readonly iterative: boolean;
    readonly multi_cds: string;
    readonly match_id: string;
}

export interface IDomainOrfBase {
    readonly id: string;
}

export interface INrpsPksOrf extends IDomainOrfBase {
    readonly sequence: string;
    readonly domains: IDomain[];
    readonly modules: IModule[];
}

export interface IDomainsOrf extends IDomainOrfBase {
    readonly seqLength: number;
    readonly domains: IHmmerDomain[];
}

export interface ICluster {
    readonly start: number;
    readonly end: number;
    readonly neighbouring_start?: number;
    readonly neighbouring_end?: number;
    readonly product?: string;
    readonly category?: string;
    readonly height: number;
    readonly tool?: string;
    readonly kind?: string;
    readonly prefix?: string;
    readonly group?: number;
}

export interface ITTACodon {
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly containedBy: string[];
}

export interface IBindingSite {
    readonly loc: number;
    readonly len: number;
}

export interface ISites {
    readonly ttaCodons: ITTACodon[];
    readonly bindingSites: IBindingSite[];
}

export interface IRegion {
    readonly anchor: string;
    readonly start: number;
    readonly end: number;
    readonly idx: number;
    readonly sites: ISites;
    readonly clusters: ICluster[];
    readonly orfs: IOrf[];
    readonly label: string;
    readonly products: string[];
    readonly product_categories: string[];
    readonly cssClass: string;
    readonly sources?: ISource[];
}

export interface IDomainsRegion {
    readonly id: string;
    readonly orfs: INrpsPksOrf[];
}

export interface IRecord {
    readonly length: number;
    readonly seq_id: string;
    readonly regions: IRegion[];
}

export interface ISource {
    readonly regionStart: number;
    readonly regionEnd: number;
    readonly recordStart: number;
    readonly recordEnd: number;
    readonly name?: string;
    scale?: d3.ScaleLinear<number, number>;
    axis?: d3.Axis<any>;
}
