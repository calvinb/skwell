const { Request, ISOLATION_LEVEL } = require( "tedious" );
const Readable = require( "readable-stream" ).Readable;

const { addRequestParams, addBulkLoadParam } = require( "./parameterBuilder" );
const types = require( "./types" );
const fileLoader = require( "./fileLoader" );

function transformRow( row ) {
	// TODO: maybe we need to make some decisions based on the sql type?
	// TODO: opportunity to camelCase here?
	// TODO: maybe we need to give the user the power to take over here?
	return row.reduce( ( acc, col, i ) => {
		acc[ col.metadata.colName || i ] = col.value;
		return acc;
	}, {} );
}

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
				addRequestParams( request, params );
				conn.execSql( request );
			} );
		} );
	}

	async executeBatch( sql ) {
		const _sql = await sql;
		return this.withConnection( conn => {
			return new Promise( ( resolve, reject ) => {
				const request = new Request( _sql, ( err, rowCount ) => {
					if ( err ) {
						return reject( err );
					}
					return resolve( rowCount );
				} );

				conn.execSqlBatch( request );
			} );
		} );
	}

	async querySets( sql, params ) {
		const _sql = await sql;
		return this.withConnection( conn => {
			const sets = [];
			let rows;
			return new Promise( ( resolve, reject ) => {
				const request = new Request( _sql, err => {
					if ( err ) {
						return reject( err );
					}
					if ( rows !== undefined ) {
						sets.push( rows );
					}
					return resolve( sets );
				} );
				addRequestParams( request, params );
				request.on( "columnMetadata", () => {
					if ( rows ) {
						sets.push( rows );
					}
					rows = [];
				} );
				request.on( "row", obj => rows.push( transformRow( obj ) ) );
				conn.execSql( request );
			} );
		} );
	}

	async query( sql, params ) {
		const sets = await this.querySets( sql, params );
		if ( sets && sets.length > 1 ) {
			throw new Error( "Query returns more than one set of data. Use querySets method to return multiple sets of data." );
		}
		return sets[ 0 ] || [];
	}

	queryStream( sql, params ) {
		const stream = new Readable( {
			objectMode: true,
			read() {}
		} );

		this.withConnection( async conn => {
			const _sql = await sql;
			return new Promise( ( resolve, reject ) => {
				const request = new Request( _sql, err => {
					if ( err ) {
						return reject( err );
					}
					stream.push( null );
					return resolve();
				} );
				addRequestParams( request, params );
				request.on( "row", obj => {
					stream.push( transformRow( obj ) );
				} );
				conn.execSql( request );
			} );
		} )
			.catch( err => {
				stream.destroy( err );
			} );

		return stream;
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

	bulkLoad( tableName, options ) {
		return this.withConnection( async conn => {
			const bulk = conn.newBulkLoad( tableName );
			addBulkLoadParam( bulk, options.schema );

			if ( options.create ) {
				await this.executeBatch( bulk.getTableCreationSql() );
			}

			for ( const row of options.rows ) {
				bulk.addRow( row );
			}

			return new Promise( ( resolve, reject ) => {
				bulk.callback = function ( err, rowCount ) {
					if ( err ) {
						return reject( err );
					}
					return resolve( rowCount );
				};
				conn.execBulkLoad( bulk );
			} );
		} );
	}

}

Object.assign( Api.prototype, types );

Object.keys( ISOLATION_LEVEL ).forEach( k => {
	Api.prototype[ k.toLowerCase() ] = ISOLATION_LEVEL[ k ];
} );

Api.prototype.fromFile = fileLoader;

module.exports = Api;
