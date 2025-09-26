// MarchingCubes.js - Modern version compatible with THREE.BufferGeometry
import {
    BufferAttribute,
    BufferGeometry,
    Vector3
} from 'https://cdn.skypack.dev/three@0.136.0';

const edgeTable = [ 0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00, 0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90, 0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30, 0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60, 0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950, 0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0, 0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0, 0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460, 0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0, 0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230, 0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190, 0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0 ];
const triTable = [ [ - 1, - 1, - 1, - 1, - 1, - 1 ], [ 0, 8, 3, - 1, - 1, - 1 ], [ 0, 1, 9, - 1, - 1, - 1 ], [ 1, 8, 3, 9, 8, 1 ], [ 1, 2, 10, - 1, - 1, - 1 ], [ 0, 8, 3, 1, 2, 10 ], [ 9, 2, 10, 0, 2, 9 ], [ 2, 8, 3, 2, 10, 8 ], [ 2, 3, 11, - 1, - 1, - 1 ], [ 0, 8, 11, 0, 11, 2 ], [ 1, 9, 0, 2, 3, 11 ], [ 1, 9, 11, 1, 11, 3 ], [ 3, 1, 10, 3, 11, 1 ], [ 1, 11, 10, 8, 11, 1 ], [ 0, 9, 2, 8, 11, 3 ], [ 8, 11, 10, 9, 10, 8 ], [ 4, 7, 8, - 1, - 1, - 1 ], [ 4, 3, 0, 4, 7, 3 ], [ 1, 9, 0, 4, 7, 8 ], [ 4, 1, 9, 4, 3, 1, 4, 7, 3 ], [ 4, 7, 8, 1, 2, 10 ], [ 3, 0, 4, 3, 4, 7, 1, 2, 10 ], [ 9, 2, 10, 9, 0, 2, 4, 7, 8 ], [ 4, 1, 9, 4, 3, 1, 4, 7, 3, 2, 10, 3 ], [ 4, 2, 3, 4, 11, 2 ], [ 0, 8, 11, 0, 11, 2, 8, 4, 11 ], [ 11, 4, 2, 0, 1, 9 ], [ 1, 9, 11, 1, 11, 4, 1, 4, 2 ], [ 4, 1, 10, 4, 10, 11, 3, 1, 10 ], [ 1, 11, 10, 8, 11, 1, 4, 11, 8 ], [ 0, 9, 2, 8, 11, 3, 4, 7, 8 ], [ 10, 9, 8, 10, 8, 11, 4, 7, 8 ], [ 5, 4, 9, - 1, - 1, - 1 ], [ 5, 4, 8, 5, 8, 3 ], [ 0, 1, 5, 0, 5, 4 ], [ 1, 8, 3, 1, 5, 8, 1, 4, 5 ], [ 5, 4, 9, 1, 2, 10 ], [ 5, 4, 8, 5, 8, 3, 1, 2, 10 ], [ 1, 5, 4, 1, 2, 5, 1, 0, 2, 2, 0, 9 ], [ 2, 8, 3, 2, 10, 8, 5, 4, 9 ], [ 5, 4, 9, 2, 3, 11 ], [ 5, 4, 8, 5, 8, 3, 2, 3, 11 ], [ 0, 1, 5, 0, 5, 4, 2, 3, 11 ], [ 1, 8, 3, 1, 5, 8, 1, 4, 5, 2, 3, 11 ], [ 5, 3, 11, 5, 1, 3, 5, 4, 1, 1, 10, 3 ], [ 1, 11, 10, 8, 11, 1, 4, 11, 8, 5, 4, 11 ], [ 8, 11, 3, 0, 9, 2, 5, 4, 9 ], [ 11, 10, 8, 11, 8, 9, 5, 4, 9 ], [ 6, 5, 10, - 1, - 1, - 1 ], [ 6, 5, 10, 7, 8, 3 ], [ 6, 5, 9, 6, 9, 0, 6, 0, 1 ], [ 1, 8, 3, 9, 8, 1, 6, 5, 9 ], [ 6, 1, 2, 6, 10, 1 ], [ 0, 8, 3, 1, 2, 10, 6, 5, 10 ], [ 6, 0, 9, 6, 5, 0, 2, 5, 9, 2, 10, 5 ], [ 2, 8, 3, 2, 10, 8, 6, 5, 9 ], [ 6, 5, 10, 2, 3, 11 ], [ 0, 8, 11, 0, 11, 2, 6, 5, 10 ], [ 6, 5, 9, 6, 9, 0, 6, 0, 1, 2, 3, 11 ], [ 1, 8, 3, 9, 8, 1, 6, 5, 9, 2, 3, 11 ], [ 6, 3, 11, 6, 1, 3, 10, 1, 3 ], [ 1, 11, 10, 8, 11, 1, 6, 1, 11 ], [ 0, 9, 2, 8, 11, 3, 6, 5, 10 ], [ 8, 11, 10, 9, 10, 8, 6, 5, 10 ], [ 7, 6, 8, 5, 6, 8 ], [ 7, 3, 0, 7, 0, 6, 5, 6, 0 ], [ 7, 6, 8, 1, 9, 0 ], [ 4, 1, 9, 4, 7, 3, 6, 5, 9 ], [ 7, 6, 8, 5, 6, 8, 1, 2, 10 ], [ 3, 0, 4, 3, 4, 7, 1, 2, 10, 5, 6, 8 ], [ 7, 6, 8, 5, 6, 8, 9, 2, 10, 9, 0, 2 ], [ 2, 10, 3, 1, 9, 4, 5, 6, 8, 7, 3, 4 ], [ 7, 6, 8, 5, 6, 8, 2, 3, 11 ], [ 8, 11, 2, 8, 2, 0, 7, 6, 8 ], [ 7, 6, 8, 5, 6, 8, 1, 9, 0, 2, 3, 11 ], [ 9, 11, 3, 9, 3, 1, 4, 2, 11, 5, 6, 8 ], [ 7, 6, 8, 5, 6, 8, 3, 1, 10, 3, 11, 1 ], [ 11, 10, 1, 11, 1, 8, 7, 6, 8 ], [ 11, 3, 8, 0, 9, 2, 7, 6, 8, 5, 6, 8 ], [ 11, 10, 8, 9, 10, 8, 7, 6, 8, 5, 6, 8 ], [ 7, 5, 4, - 1, - 1, - 1 ], [ 7, 5, 4, 8, 3, 0 ], [ 7, 5, 4, 9, 0, 1 ], [ 8, 3, 0, 9, 0, 1, 7, 5, 4 ], [ 7, 5, 4, 10, 1, 2 ], [ 8, 3, 0, 10, 1, 2, 7, 5, 4 ], [ 7, 5, 4, 9, 0, 1, 10, 1, 2 ], [ 8, 3, 0, 9, 0, 1, 10, 1, 2, 7, 5, 4 ], [ 7, 5, 4, 11, 2, 3 ], [ 0, 8, 3, 11, 2, 3, 7, 5, 4 ], [ 7, 5, 4, 9, 0, 1, 11, 2, 3 ], [ 8, 3, 0, 9, 0, 1, 11, 2, 3, 7, 5, 4 ], [ 7, 5, 4, 10, 1, 2, 11, 2, 3 ], [ 8, 3, 0, 10, 1, 2, 11, 2, 3, 7, 5, 4 ], [ 7, 5, 4, 9, 0, 1, 10, 1, 2, 11, 2, 3 ], [ 8, 3, 0, 9, 0, 1, 10, 1, 2, 11, 2, 3, 7, 5, 4 ], [ 7, 6, 5, - 1, - 1, - 1 ], [ 7, 6, 5, 8, 3, 0 ], [ 7, 6, 5, 9, 0, 1 ], [ 8, 3, 0, 9, 0, 1, 7, 6, 5 ], [ 7, 6, 5, 10, 1, 2 ], [ 8, 3, 0, 10, 1, 2, 7, 6, 5 ], [ 7, 6, 5, 9, 0, 1, 10, 1, 2 ], [ 8, 3, 0, 9, 0, 1, 10, 1, 2, 7, 6, 5 ], [ 7, 6, 5, 11, 2, 3 ], [ 8, 3, 0, 11, 2, 3, 7, 6, 5 ], [ 7, 6, 5, 9, 0, 1, 11, 2, 3 ], [ 8, 3, 0, 9, 0, 1, 11, 2, 3, 7, 6, 5 ], [ 7, 6, 5, 10, 1, 2, 11, 2, 3 ], [ 8, 3, 0, 10, 1, 2, 11, 2, 3, 7, 6, 5 ], [ 7, 6, 5, 9, 0, 1, 10, 1, 2, 11, 2, 3 ], [ 8, 3, 0, 9, 0, 1, 10, 1, 2, 11, 2, 3, 7, 6, 5 ], [ 6, 2, 10, 6, 11, 2 ], [ 7, 8, 3, 6, 2, 10, 6, 11, 2 ], [ 6, 2, 10, 6, 11, 2, 9, 0, 1 ], [ 1, 8, 3, 9, 8, 1, 6, 2, 10, 6, 11, 2 ], [ 6, 1, 2, 11, 1, 6 ], [ 0, 8, 3, 1, 6, 2, 1, 11, 6 ], [ 11, 0, 9, 11, 6, 0, 2, 6, 9 ], [ 3, 8, 2, 9, 8, 1, 11, 6, 2 ], [ 7, 8, 4, 6, 2, 10, 6, 11, 2 ], [ 10, 11, 2, 10, 2, 6, 8, 4, 7 ], [ 6, 2, 10, 6, 11, 2, 9, 0, 1, 8, 4, 7 ], [ 1, 8, 3, 9, 8, 1, 6, 2, 10, 6, 11, 2, 8, 4, 7 ], [ 11, 1, 6, 11, 6, 4, 10, 1, 6 ], [ 4, 7, 8, 10, 1, 6, 10, 11, 6 ], [ 1, 6, 11, 1, 11, 4, 1, 4, 0, 0, 4, 9 ], [ 8, 4, 7, 9, 0, 1, 11, 6, 2 ], [ 11, 5, 10, 11, 4, 5, 6, 4, 11 ], [ 8, 3, 0, 7, 4, 11, 7, 11, 6, 5, 10, 11 ], [ 11, 5, 10, 11, 4, 5, 6, 4, 11, 0, 1, 9 ], [ 8, 3, 0, 7, 4, 11, 7, 11, 6, 5, 10, 11, 1, 9, 0 ], [ 10, 5, 6, 1, 5, 10, 3, 5, 1, 11, 5, 3 ], [ 1, 11, 10, 8, 11, 1, 6, 5, 11, 4, 5, 11 ], [ 0, 9, 2, 8, 11, 3, 6, 5, 10, 4, 5, 10 ], [ 11, 10, 8, 9, 10, 8, 6, 5, 10, 4, 5, 10 ], [ 10, 7, 11, 10, 6, 7, 5, 6, 10 ], [ 8, 3, 0, 5, 6, 10, 7, 11, 10 ], [ 10, 7, 11, 10, 6, 7, 5, 6, 10, 0, 1, 9 ], [ 8, 3, 0, 5, 6, 10, 7, 11, 10, 1, 9, 0 ], [ 11, 1, 2, 11, 7, 1, 11, 6, 7, 5, 6, 7 ], [ 8, 3, 0, 7, 11, 6, 7, 6, 2, 7, 2, 1, 5, 2, 6 ], [ 11, 1, 2, 11, 7, 1, 11, 6, 7, 5, 6, 7, 0, 9, 1 ], [ 8, 3, 0, 11, 2, 7, 5, 6, 7, 9, 0, 1 ], [ 10, 7, 5, 10, 5, 1, 11, 1, 5, 6, 1, 5 ], [ 1, 11, 10, 6, 1, 5, 4, 1, 7 ], [ 9, 0, 8, 5, 2, 11, 5, 6, 2, 7, 2, 6 ], [ 11, 10, 8, 9, 10, 8, 7, 6, 5, 4, 7, 5 ], [ 7, 8, 9, - 1, - 1, - 1 ], [ 7, 8, 9, 3, 0, 4 ], [ 7, 8, 9, 10, 1, 2 ], [ 3, 0, 4, 10, 1, 2, 7, 8, 9 ], [ 7, 8, 9, 11, 2, 3 ], [ 3, 0, 4, 11, 2, 3, 7, 8, 9 ], [ 7, 8, 9, 10, 1, 2, 11, 2, 3 ], [ 3, 0, 4, 10, 1, 2, 11, 2, 3, 7, 8, 9 ], [ 7, 8, 9, 5, 4, 6 ], [ 3, 0, 4, 5, 4, 6, 7, 8, 9 ], [ 7, 8, 9, 5, 4, 6, 10, 1, 2 ], [ 3, 0, 4, 5, 4, 6, 10, 1, 2, 7, 8, 9 ], [ 7, 8, 9, 5, 4, 6, 11, 2, 3 ], [ 3, 0, 4, 5, 4, 6, 11, 2, 3, 7, 8, 9 ], [ 7, 8, 9, 5, 4, 6, 10, 1, 2, 11, 2, 3 ], [ 3, 0, 4, 5, 4, 6, 10, 1, 2, 11, 2, 3, 7, 8, 9 ], [ 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 0, 4, 7 ], [ 8, 9, 10, 8, 11, 9, 1, 2, 7 ], [ 0, 4, 7, 1, 2, 7, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 2, 3, 7 ], [ 0, 4, 7, 2, 3, 7, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 1, 2, 7, 2, 3, 7 ], [ 0, 4, 7, 1, 2, 7, 2, 3, 7, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 4, 6, 5 ], [ 0, 4, 7, 4, 6, 5, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 4, 6, 5, 1, 2, 7 ], [ 0, 4, 7, 4, 6, 5, 1, 2, 7, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 4, 6, 5, 2, 3, 7 ], [ 0, 4, 7, 4, 6, 5, 2, 3, 7, 8, 9, 10, 8, 11, 9 ], [ 8, 9, 10, 8, 11, 9, 4, 6, 5, 1, 2, 7, 2, 3, 7 ], [ 0, 4, 7, 4, 6, 5, 1, 2, 7, 2, 3, 7, 8, 9, 10, 8, 11, 9 ], [ 11, 9, 10, - 1, - 1, - 1 ], [ 11, 9, 10, 0, 4, 7 ], [ 11, 9, 10, 1, 2, 7 ], [ 0, 4, 7, 1, 2, 7, 11, 9, 10 ], [ 11, 9, 10, 2, 3, 7 ], [ 0, 4, 7, 2, 3, 7, 11, 9, 10 ], [ 11, 9, 10, 1, 2, 7, 2, 3, 7 ], [ 0, 4, 7, 1, 2, 7, 2, 3, 7, 11, 9, 10 ], [ 11, 9, 10, 4, 6, 5 ], [ 0, 4, 7, 4, 6, 5, 11, 9, 10 ], [ 11, 9, 10, 4, 6, 5, 1, 2, 7 ], [ 0, 4, 7, 4, 6, 5, 1, 2, 7, 11, 9, 10 ], [ 11, 9, 10, 4, 6, 5, 2, 3, 7 ], [ 0, 4, 7, 4, 6, 5, 2, 3, 7, 11, 9, 10 ], [ 11, 9, 10, 4, 6, 5, 1, 2, 7, 2, 3, 7 ], [ 0, 4, 7, 4, 6, 5, 1, 2, 7, 2, 3, 7, 11, 9, 10 ] ];

const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();

const n1 = new Vector3();
const n2 = new Vector3();
const n3 = new Vector3();

class MarchingCubes {

	constructor( resolution, material ) {

		this.resolution = resolution;
		this.material = material;

		this.size = resolution;
		this.size2 = resolution * resolution;
		this.size3 = resolution * resolution * resolution;

		this.field = new Float32Array( this.size3 );
		this.isolation = 0;

		this.normal_cache = {};

		this.position = new Vector3();
		this.scale = new Vector3( 1, 1, 1 );

	}

	begin() {

		let i = 0;
		const l = this.field.length;

		for ( i = 0; i < l; i ++ ) {

			this.field[ i ] = 0;

		}

		this.normal_cache = {};

	}

	end() {

		const normals = [];
		const positions = [];

		let x, y, z;
		let plot;

		let i, j, k;

		for ( i = 0; i < this.size; i ++ ) {

			for ( j = 0; j < this.size; j ++ ) {

				for ( k = 0; k < this.size; k ++ ) {

					// Voxel grid coordinates
					x = i;
					y = j;
					z = k;

					// Unpack field values
					const p = x * this.size2 + y * this.size + z;

					const p1 = this.field[ p ];
					const p2 = this.field[ p + this.size2 ];
					const p3 = this.field[ p + this.size2 + this.size ];
					const p4 = this.field[ p + this.size ];
					const p5 = this.field[ p + 1 ];
					const p6 = this.field[ p + this.size2 + 1 ];
					const p7 = this.field[ p + this.size2 + this.size + 1 ];
					const p8 = this.field[ p + this.size + 1 ];

					// Determine crossing vertices
					let cubeindex = 0;
					if ( p1 < this.isolation ) cubeindex |= 1;
					if ( p2 < this.isolation ) cubeindex |= 2;
					if ( p3 < this.isolation ) cubeindex |= 4;
					if ( p4 < this.isolation ) cubeindex |= 8;
					if ( p5 < this.isolation ) cubeindex |= 16;
					if ( p6 < this.isolation ) cubeindex |= 32;
					if ( p7 < this.isolation ) cubeindex |= 64;
					if ( p8 < this.isolation ) cubeindex |= 128;

					// Get edgelist from table
					const bits = edgeTable[ cubeindex ];

					// If no edges are crossed, we're done here
					if ( bits === 0 ) continue;

					// Interpolate vertex positions
					let mu = 0.5;

					// Bottom of the cube
					if ( ( bits & 1 ) > 0 ) {

						mu = ( this.isolation - p1 ) / ( p2 - p1 );
						v1.set( x + mu, y, z );

					}

					if ( ( bits & 2 ) > 0 ) {

						mu = ( this.isolation - p2 ) / ( p3 - p2 );
						v2.set( x + 1, y + mu, z );

					}

					if ( ( bits & 4 ) > 0 ) {

						mu = ( this.isolation - p4 ) / ( p3 - p4 );
						v3.set( x + mu, y + 1, z );

					}

					// Top of the cube
					if ( ( bits & 8 ) > 0 ) {

						mu = ( this.isolation - p1 ) / ( p4 - p1 );
						v1.set( x, y + mu, z );

					}

					if ( ( bits & 16 ) > 0 ) {

						mu = ( this.isolation - p5 ) / ( p6 - p5 );
						v2.set( x + mu, y, z + 1 );

					}

					if ( ( bits & 32 ) > 0 ) {

						mu = ( this.isolation - p6 ) / ( p7 - p6 );
						v3.set( x + 1, y + mu, z + 1 );

					}

					if ( ( bits & 64 ) > 0 ) {

						mu = ( this.isolation - p8 ) / ( p7 - p8 );
						v1.set( x + mu, y + 1, z + 1 );

					}

					if ( ( bits & 128 ) > 0 ) {

						mu = ( this.isolation - p5 ) / ( p8 - p5 );
						v2.set( x, y + mu, z + 1 );

					}

					// Sides of the cube
					if ( ( bits & 256 ) > 0 ) {

						mu = ( this.isolation - p1 ) / ( p5 - p1 );
						v3.set( x, y, z + mu );

					}

					if ( ( bits & 512 ) > 0 ) {

						mu = ( this.isolation - p2 ) / ( p6 - p2 );
						v1.set( x + 1, y, z + mu );

					}

					if ( ( bits & 1024 ) > 0 ) {

						mu = ( this.isolation - p4 ) / ( p8 - p4 );
						v2.set( x, y + 1, z + mu );

					}

					if ( ( bits & 2048 ) > 0 ) {

						mu = ( this.isolation - p3 ) / ( p7 - p3 );
						v3.set( x + 1, y + 1, z + mu );

					}

					// Pack triangles
					let i = 0;
					cubeindex <<= 4; // Re-purpose cubeindex into an offset into triTable

					// Form triangles
					while ( triTable[ cubeindex + i ] != - 1 ) {

						const i1 = triTable[ cubeindex + i ];
						const i2 = triTable[ cubeindex + i + 1 ];
						const i3 = triTable[ cubeindex + i + 2 ];

						// Add 3 vertices of the triangle
						// All edge vertices are calculated, but only the ones needed for the triangles are selected
						// based on the triangulation table
						plot = this.edgeVertex( i1, p1, p2, p3, p4, p5, p6, p7, p8, x, y, z );
						v1.set( plot[ 0 ], plot[ 1 ], plot[ 2 ] );

						plot = this.edgeVertex( i2, p1, p2, p3, p4, p5, p6, p7, p8, x, y, z );
						v2.set( plot[ 0 ], plot[ 1 ], plot[ 2 ] );

						plot = this.edgeVertex( i3, p1, p2, p3, p4, p5, p6, p7, p8, x, y, z );
						v3.set( plot[ 0 ], plot[ 1 ], plot[ 2 ] );

						// Transform to world space
						v1.multiply( this.scale ).add( this.position );
						v2.multiply( this.scale ).add( this.position );
						v3.multiply( this.scale ).add( this.position );

						// Get normals
						this.getNormal( n1, v1 );
						this.getNormal( n2, v2 );
						this.getNormal( n3, v3 );

						positions.push( v1.x, v1.y, v1.z );
						positions.push( v2.x, v2.y, v2.z );
						positions.push( v3.x, v3.y, v3.z );

						normals.push( n1.x, n1.y, n1.z );
						normals.push( n2.x, n2.y, n2.z );
						normals.push( n3.x, n3.y, n3.z );

						i += 3;

					}

				}

			}

		}

		// Return a buffer geometry
		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( positions ), 3 ) );
		geometry.setAttribute( 'normal', new BufferAttribute( new Float32Array( normals ), 3 ) );

		return geometry;

	}

	edgeVertex( i, p1, p2, p3, p4, p5, p6, p7, p8, x, y, z ) {

		let mu;
		const a = new Vector3();
		const b = new Vector3();

		switch ( i ) {

			case 0:
				mu = ( this.isolation - p1 ) / ( p2 - p1 );
				a.set( x, y, z );
				b.set( x + 1, y, z );
				return [ a.x + mu * ( b.x - a.x ), a.y, a.z ];

			case 1:
				mu = ( this.isolation - p2 ) / ( p3 - p2 );
				a.set( x + 1, y, z );
				b.set( x + 1, y + 1, z );
				return [ a.x, a.y + mu * ( b.y - a.y ), a.z ];

			case 2:
				mu = ( this.isolation - p4 ) / ( p3 - p4 );
				a.set( x, y + 1, z );
				b.set( x + 1, y + 1, z );
				return [ a.x + mu * ( b.x - a.x ), a.y, a.z ];

			case 3:
				mu = ( this.isolation - p1 ) / ( p4 - p1 );
				a.set( x, y, z );
				b.set( x, y + 1, z );
				return [ a.x, a.y + mu * ( b.y - a.y ), a.z ];

			case 4:
				mu = ( this.isolation - p5 ) / ( p6 - p5 );
				a.set( x, y, z + 1 );
				b.set( x + 1, y, z + 1 );
				return [ a.x + mu * ( b.x - a.x ), a.y, a.z ];

			case 5:
				mu = ( this.isolation - p6 ) / ( p7 - p6 );
				a.set( x + 1, y, z + 1 );
				b.set( x + 1, y + 1, z + 1 );
				return [ a.x, a.y + mu * ( b.y - a.y ), a.z ];

			case 6:
				mu = ( this.isolation - p8 ) / ( p7 - p8 );
				a.set( x, y + 1, z + 1 );
				b.set( x + 1, y + 1, z + 1 );
				return [ a.x + mu * ( b.x - a.x ), a.y, a.z ];

			case 7:
				mu = ( this.isolation - p5 ) / ( p8 - p5 );
				a.set( x, y, z + 1 );
				b.set( x, y + 1, z + 1 );
				return [ a.x, a.y + mu * ( b.y - a.y ), a.z ];

			case 8:
				mu = ( this.isolation - p1 ) / ( p5 - p1 );
				a.set( x, y, z );
				b.set( x, y, z + 1 );
				return [ a.x, a.y, a.z + mu * ( b.z - a.z ) ];

			case 9:
				mu = ( this.isolation - p2 ) / ( p6 - p2 );
				a.set( x + 1, y, z );
				b.set( x + 1, y, z + 1 );
				return [ a.x, a.y, a.z + mu * ( b.z - a.z ) ];

			case 10:
				mu = ( this.isolation - p4 ) / ( p8 - p4 );
				a.set( x, y + 1, z );
				b.set( x, y + 1, z + 1 );
				return [ a.x, a.y, a.z + mu * ( b.z - a.z ) ];

			case 11:
				mu = ( this.isolation - p3 ) / ( p7 - p3 );
				a.set( x + 1, y + 1, z );
				b.set( x + 1, y + 1, z + 1 );
				return [ a.x, a.y, a.z + mu * ( b.z - a.z ) ];

		}

	}

	getNormal( target, point ) {

		// Approximate the normal
		const epsilon = 0.0001;

		// Get field values at the current point
		const p = this.getFieldValue( this.field, point.x, point.y, point.z );

		// Get field values at points nearby
		const px = this.getFieldValue( this.field, point.x + epsilon, point.y, point.z );
		const py = this.getFieldValue( this.field, point.x, point.y + epsilon, point.z );
		const pz = this.getFieldValue( this.field, point.x, point.y, point.z + epsilon );

		// Calculate the difference between the field values
		target.set( p - px, p - py, p - pz ).normalize();

	}

	getFieldValue( field, x, y, z ) {

		// Scale the point to the size of the voxel grid
		const sx = x / this.scale.x;
		const sy = y / this.scale.y;
		const sz = z / this.scale.z;

		const_x_ = Math.floor( sx );
		const_y_ = Math.floor( sy );
		const_z_ = Math.floor( sz );

		// Get the field values at the 8 corners of the cube
		const p = const_x_ * this.size2 + const_y_ * this.size + const_z_;

		// Check if the point is within the bounds of the voxel grid
		if ( p < 0 || p > this.field.length ) return 0;

		const p1 = this.field[ p ];
		const p2 = this.field[ p + this.size2 ];
		const p3 = this.field[ p + this.size2 + this.size ];
		const p4 = this.field[ p + this.size ];
		const p5 = this.field[ p + 1 ];
		const p6 = this.field[ p + this.size2 + 1 ];
		const p7 = this.field[ p + this.size2 + this.size + 1 ];
		const p8 = this.field[ p + this.size + 1 ];

		// Interpolate the field values
		const_x_d = sx - const_x_;
		const_y_d = sy - const_y_;
		const_z_d = sz - const_z_;

		const c00 = p1 * ( 1 - const_x_d ) + p2 * const_x_d;
		const c10 = p4 * ( 1 - const_x_d ) + p3 * const_x_d;
		const c01 = p5 * ( 1 - const_x_d ) + p6 * const_x_d;
		const c11 = p8 * ( 1 - const_x_d ) + p7 * const_x_d;

		const c0 = c00 * ( 1 - const_y_d ) + c10 * const_y_d;
		const c1 = c01 * ( 1 - const_y_d ) + c11 * const_y_d;

		const c = c0 * ( 1 - const_z_d ) + c1 * const_z_d;

		return c;

	}

}

export { MarchingCubes };