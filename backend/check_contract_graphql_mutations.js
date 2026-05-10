const axios = require('axios');

async function introspectMutations() {
    const URL = 'https://contract.resilientdb.com/graphql';

    const GET_SCHEMA_QUERY = `
    query {
        __schema {
            mutationType {
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
        const mutationTypeName = data.mutationType.name;
        const mutationType = data.types.find(t => t.name === mutationTypeName);

        console.log(`\nURL: ${URL}`);
        if (!mutationType) {
            console.log("No Root Mutation Fields found.");
            return;
        }
        console.log(`Root Mutation Fields (${mutationTypeName}):`);
        mutationType.fields.forEach(f => {
            const args = f.args.map(a => `${a.name}`);
            console.log(` - ${f.name}(${args.join(', ')})`);
        });
    } catch (e) {
        console.error(`\nURL: ${URL}`);
        console.error(e.message);
    }
}
introspectMutations();
