var fs = require('fs')
function a ( fs ) {
  return fs.readFileSync() // should not be replaced
}
T.equal(
    a( { readFileSync : function ()  { return 'xyz' } } ),
    'xyz'
)

T.equal( fs.readFileSync(), 'read the file!' )

{ // hello block scope
    let fs = { readFileSync: () => 'abc' }
    T.equal(fs.readFileSync(), 'abc')
}

T.equal( fs.readFileSync(), 'read the file!' )
