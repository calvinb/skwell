const { config } = testHelpers;

const skwell = require( "src/" );
describe( "Basic - Integration", () => {
	let sql;
	before( () => {
		sql = skwell.connect( config );
		return sql.execute( sql.fromFile( "sql/basic-setup" ) );
	} );

	after( () => {
		return sql.dispose();
	} );

	describe( "execute", () => {
		it( "should work without params", () => {
			const query = `
				INSERT INTO MutationTests
				VALUES (1,'A'), (2, 'B');`;

			return sql.execute( query )
				.should.eventually.equal( 2 );
		} );

		it( "should work with params", () => {
			const query = `
				INSERT INTO MutationTests
				VALUES (@id,@name);`;

			return sql.execute( query, {
				id: { val: 3, type: sql.int },
				name: { val: "C", type: sql.nvarchar( 10 ) }
			} )
				.should.eventually.equal( 1 );
		} );
	} );

	describe( "query", () => {
		it( "should work without params", () => {
			const query = `
				SELECT *
				FROM QueryTests
				ORDER BY id DESC`;

			return sql.query( query )
				.should.eventually.deep.equal( [
					{ id: 3, test: "C" },
					{ id: 2, test: "B" },
					{ id: 1, test: "A" }
				] );
		} );

		it( "should work with params", () => {
			const query = `
				SELECT *
				FROM QueryTests
				WHERE id > @id
				ORDER BY id DESC`;

			return sql.query( query, {
				id: { val: 1, type: sql.int }
			} )
				.should.eventually.deep.equal( [
					{ id: 3, test: "C" },
					{ id: 2, test: "B" }
				] );
		} );

		it( "should work with an object array param", () => {
			const query = `
				SELECT *
				FROM @users`;

			return sql
				.query( query, {
					users: {
						val: [ { id: 1 }, { id: 2 } ],
						type: {
							id: sql.int
						}
					}
				} )
				.should.eventually.deep.equal( [
					{ id: 1 },
					{ id: 2 }
				] );
		} );

		it( "should work with a value array param", () => {
			const query = `
				SELECT value
				FROM @userIds`;

			return sql
				.query( query, {
					userIds: {
						val: [ 1, 2 ],
						type: sql.int
					}
				} )
				.should.eventually.deep.equal( [
					{ value: 1 },
					{ value: 2 }
				] );
		} );
	} );

	describe( "queryFirst", () => {
		it( "should work without params", () => {
			const query = `
				SELECT *
				FROM QueryTests
				ORDER BY id DESC`;

			return sql.queryFirst( query )
				.should.eventually.deep.equal( {
					id: 3,
					test: "C"
				} );
		} );

		it( "should work with params", () => {
			const query = `
				SELECT *
				FROM QueryTests
				WHERE id = @id
				ORDER BY id DESC`;

			return sql.queryFirst( query, {
				id: { val: 1, type: sql.int }
			} )
				.should.eventually.deep.equal( {
					id: 1,
					test: "A"
				} );
		} );
	} );

	describe( "queryValue", () => {
		it( "should work without params", () => {
			const query = `
				SELECT test
				FROM QueryTests
				ORDER BY id DESC`;

			return sql.queryValue( query )
				.should.eventually.equal( "C" );
		} );

		it( "should work with params", () => {
			const query = `
				SELECT test
				FROM QueryTests
				WHERE id = @id
				ORDER BY id DESC`;

			return sql.queryValue( query, {
				id: { val: 1, type: sql.int }
			} )
				.should.eventually.equal( "A" );
		} );
	} );
} );
