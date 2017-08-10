const Request = require( "tedious" ).Request;

const parameterBuilder = require( "./parameterBuilder" );
const types = require( "./types" );
const fileLoader = require( "./fileLoader" );

function transformRow( row ) {
	// TODO: maybe we need to make some decisions based on the sql type?
	// TODO: opportunity to camelCase here?
	// TODO: maybe we need to give the user the power to take over here?
	return row.reduce( ( acc, col ) => {
		acc[ col.metadata.colName ] = col.value;
		return acc;
	}, {} );
}

// TODO: implement the following:
// - multiple result sets
// - bulk loading
// - streaming

class Api {

	async execute( sql, params ) {
		const _sql = await sql;
		return this.withConnection( conn => {
			return new Promise( ( resolve, reject ) => {
				const request = new Request( _sql, ( err, rowCount ) => {
					if ( err ) {
						return reject( err );
					}
					return resolve( rowCount );
				} );
				parameterBuilder( request, params );
				conn.execSql( request );
			} );
		} );
	}

	async query( sql, params ) {
		const _sql = await sql;
		const results = await this.withConnection( conn => {
			const data = [];
			return new Promise( ( resolve, reject ) => {
				const request = new Request( _sql, err => {
					if ( err ) {
						return reject( err );
					}
					return resolve( data );
				} );
				parameterBuilder( request, params );
				request.on( "row", obj => data.push( obj ) );
				conn.execSql( request );
			} );
		} );

		return results.map( transformRow );
	}

	async queryFirst( sql, params ) {
		const result = await this.query( sql, params );
		// TODO: throw Error if shape of data > 1 row?
		return result[ 0 ] || null;
	}

	// This implementation is weird because we're letting tedious pull objects.
	// Would we rather listen for the 'columnMetadata' event also and take better control of this?
	async queryValue( sql, params ) {
		const result = await this.queryFirst( sql, params );
		// TODO: throw Error if shape of data > 1 property?
		if ( result ) {
			for ( const prop in result ) { // eslint-disable-line guard-for-in
				return result[ prop ];
			}
		}
		return null;
	}

}

Object.assign( Api.prototype, types );
Api.prototype.fromFile = fileLoader;
module.exports = Api;
