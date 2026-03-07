export function evaluatePipelinePreview(nodes: any[], edges: any[], sourceRows: any[]) {
    // Map to hold data at each node ID
    const dataMap = new Map<string, any[]>();

    // 1. Initialize source nodes
    const sourceNodes = nodes.filter((n: any) => n.data?.nodeType === 'source');
    sourceNodes.forEach(sn => dataMap.set(sn.id, JSON.parse(JSON.stringify(sourceRows))));

    // 2. Kahn's topological sort
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    nodes.forEach(n => {
        inDegree.set(n.id, 0);
        adj.set(n.id, []);
    });

    edges.forEach((e: any) => {
        if (inDegree.has(e.target)) {
            inDegree.set(e.target, inDegree.get(e.target)! + 1);
        }
        if (adj.has(e.source)) {
            adj.get(e.source)!.push(e.target);
        }
    });

    const q: string[] = [];
    inDegree.forEach((deg, id) => {
        if (deg === 0) q.push(id);
    });

    const sorted: string[] = [];
    while (q.length > 0) {
        const u = q.shift()!;
        sorted.push(u);
        const neighbors = adj.get(u) || [];
        for (const v of neighbors) {
            inDegree.set(v, inDegree.get(v)! - 1);
            if (inDegree.get(v) === 0) q.push(v);
        }
    }

    // 3. Evaluate step by step
    for (const id of sorted) {
        const node = nodes.find(n => n.id === id);
        if (!node) continue;

        const ntype = node.data?.nodeType;
        // Skip source since it's already seeded
        if (ntype === 'source') continue;

        // Get input data from incoming edge
        const incoming = edges.filter((e: any) => e.target === id);
        if (incoming.length === 0) continue;

        // For now, take the first incoming edge data (Join logic is more complex)
        const inputId = incoming[0].source;
        const rawInputData = dataMap.get(inputId) || [];
        // Deep clone so we don't mutate parent state
        let outputData = JSON.parse(JSON.stringify(rawInputData));

        const conf = node.data?.config || {};

        try {
            switch (ntype) {
                case 'filter': {
                    const { column, operator, value } = conf;
                    if (column && operator && value !== undefined && value !== '') {
                        outputData = outputData.filter((row: any) => {
                            const rv = String(row[column] ?? '');
                            const vv = String(value);
                            const rN = Number(rv);
                            const vN = Number(vv);

                            switch (operator) {
                                case '=': return rv.toLowerCase() === vv.toLowerCase();
                                case '!=': return rv.toLowerCase() !== vv.toLowerCase();
                                case 'contains': return rv.toLowerCase().includes(vv.toLowerCase());
                                case 'startsWith': return rv.toLowerCase().startsWith(vv.toLowerCase());
                                case '>': return !isNaN(rN) && !isNaN(vN) ? rN > vN : rv > vv;
                                case '<': return !isNaN(rN) && !isNaN(vN) ? rN < vN : rv < vv;
                                case '>=': return !isNaN(rN) && !isNaN(vN) ? rN >= vN : rv >= vv;
                                case '<=': return !isNaN(rN) && !isNaN(vN) ? rN <= vN : rv <= vv;
                                default: return true;
                            }
                        });
                    }
                    break;
                }
                case 'transform': {
                    const { column, operation } = conf;
                    if (column && operation) {
                        outputData = outputData.map((row: any) => {
                            const val = row[column];
                            if (val !== undefined && val !== null) {
                                switch (operation) {
                                    case 'uppercase': row[column] = String(val).toUpperCase(); break;
                                    case 'lowercase': row[column] = String(val).toLowerCase(); break;
                                    case 'trim': row[column] = String(val).trim(); break;
                                    case 'round': row[column] = Math.round(Number(val)); break;
                                    case 'toNumber': row[column] = Number(val); break;
                                    case 'toString': row[column] = String(val); break;
                                }
                            }
                            return row;
                        });
                    }
                    break;
                }
                case 'select': {
                    const { columns } = conf;
                    if (columns && typeof columns === 'string') {
                        const cols = columns.split(',').map((c: string) => c.trim()).filter(Boolean);
                        if (cols.length > 0) {
                            outputData = outputData.map((row: any) => {
                                const newRow: any = {};
                                cols.forEach((c: string) => { newRow[c] = row[c]; });
                                return newRow;
                            });
                        }
                    }
                    break;
                }
                case 'sort': {
                    const { column, direction } = conf;
                    if (column) {
                        outputData = outputData.sort((a: any, b: any) => {
                            const av = a[column] ?? '';
                            const bv = b[column] ?? '';
                            const mod = direction === 'desc' ? -1 : 1;
                            if (av < bv) return -1 * mod;
                            if (av > bv) return 1 * mod;
                            return 0;
                        });
                    }
                    break;
                }
                case 'deduplicate': {
                    const { columns } = conf;
                    if (columns && typeof columns === 'string') {
                        const cols = columns.split(',').map((c: string) => c.trim()).filter(Boolean);
                        if (cols.length > 0) {
                            const seen = new Set();
                            outputData = outputData.filter((row: any) => {
                                const key = cols.map((c: string) => row[c]).join('|');
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                            });
                        }
                    }
                    break;
                }
                // Join and Aggregate can be mapped similarly if needed, but keeping it simple for preview
            }
        } catch (err) {
            console.warn('Preview evaluation error on node', id, err);
        }

        dataMap.set(id, outputData);
    }

    return dataMap;
}

