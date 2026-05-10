const axios = require('axios');

async function introspect() {
    const URL = 'https://contract.resilientdb.com/graphql';

    const GET_SCHEMA_QUERY = `
    query {
        __schema {
            queryType {
                name
            }
            types {
                name
                fields {
                    name
                    args {
                        name
                        type {
                            name
                            kind
                            ofType {
                                name
                                kind
                            }
                        }
                    }
                }
            }
        }
    }`;

    try {
        const res = await axios.post(URL, { query: GET_SCHEMA_QUERY }, { timeout: 10000 });
        const data = res.data.data.__schema;
        const queryTypeName = data.queryType.name;
        const queryType = data.types.find(t => t.name === queryTypeName);

        console.log(`\nURL: ${URL}`);
        if (!queryType) {
            console.log("No Root Query Fields found.");
            return;
        }
        console.log(`Root Query Fields (${queryTypeName}):`);
        queryType.fields.forEach(f => {
            const args = f.args.map(a => `${a.name}`);
            console.log(` - ${f.name}(${args.join(', ')})`);
        });
    } catch (e) {
        console.error(`\nURL: ${URL}`);
        console.error(e.message);
    }
}
introspect();
