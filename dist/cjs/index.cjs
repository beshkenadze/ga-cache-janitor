"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    parseHumanReadableSize: function() {
        return parseHumanReadableSize;
    },
    parseHumanReadableTime: function() {
        return parseHumanReadableTime;
    },
    run: function() {
        return run;
    }
});
const _core = /*#__PURE__*/ _interop_require_wildcard(require("@actions/core"));
const _github = /*#__PURE__*/ _interop_require_wildcard(require("@actions/github"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function setFailedWrongValue(input, value) {
    _core.setFailed(`Wrong value for the input '${input}': ${value}`);
}
var Inputs;
(function(Inputs) {
    Inputs["Debug"] = "debug";
    Inputs["MaxAge"] = "max-age";
    Inputs["MaxTotalSize"] = "max-total-size";
    Inputs["Accessed"] = "accessed";
    Inputs["Created"] = "created";
    Inputs["Token"] = "token";
})(Inputs || (Inputs = {}));
function parseHumanReadableTime(input) {
    const match = input.match(/^(\d+)([dhwMy])$/);
    if (!match) {
        throw new Error(`Invalid time format: ${input}. Expected format like "7d", "1w", "2M", "1y".`);
    }
    const [, value, unit] = match;
    const numValue = parseInt(value, 10);
    switch(unit){
        case "d":
            return numValue * 24 * 60 * 60;
        case "h":
            return numValue * 60 * 60;
        case "w":
            return numValue * 7 * 24 * 60 * 60;
        case "M":
            return numValue * 30 * 24 * 60 * 60;
        case "y":
            return numValue * 365 * 24 * 60 * 60;
        default:
            throw new Error(`Unknown time unit: ${unit}`);
    }
}
function parseHumanReadableSize(input) {
    const match = input.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)$/i);
    if (!match) {
        const unitMatch = input.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
        if (unitMatch) {
            throw new Error(`Unknown size unit: ${unitMatch[2]}. Expected format like "500MB", "1.5GB", "10TB".`);
        }
        throw new Error(`Invalid size format: ${input}. Expected format like "500MB", "1.5GB", "10TB".`);
    }
    const [, value, unit] = match;
    const numValue = parseFloat(value);
    switch(unit.toUpperCase()){
        case "KB":
            return numValue * 1024;
        case "MB":
            return numValue * 1024 * 1024;
        case "GB":
            return numValue * 1024 * 1024 * 1024;
        case "TB":
            return numValue * 1024 * 1024 * 1024 * 1024;
        default:
            throw new Error(`Unknown size unit: ${unit}`);
    }
}
async function run() {
    try {
        const debug = _core.getInput("debug", {
            required: false
        }) === "true";
        const maxAgeInput = _core.getInput("max-age", {
            required: true
        });
        const maxTotalSizeInput = _core.getInput("max-total-size", {
            required: false
        });
        const accessed = _core.getInput("accessed", {
            required: false
        }) === "true";
        const created = _core.getInput("created", {
            required: false
        }) === "true";
        const token = _core.getInput("token", {
            required: true
        });
        if (debug) {
            console.log(`Debug mode enabled`);
        }
        if (!maxAgeInput) {
            _core.setFailed("Input 'max-age' is required and cannot be empty.");
            return;
        }
        if (!token) {
            _core.setFailed("Input 'token' is required and cannot be empty.");
            return;
        }
        let maxAge;
        try {
            maxAge = parseHumanReadableTime(maxAgeInput);
        } catch (error) {
            if (error instanceof Error) {
                _core.setFailed(`Invalid 'max-age' input: ${error.message}`);
            } else {
                _core.setFailed(`Invalid 'max-age' input: An unknown error occurred`);
            }
            return;
        }
        const maxDate = new Date(Date.now() - maxAge * 1000);
        let maxTotalSize = Infinity;
        if (maxTotalSizeInput) {
            try {
                maxTotalSize = parseHumanReadableSize(maxTotalSizeInput);
            } catch (error) {
                if (error instanceof Error) {
                    _core.setFailed(`Invalid 'max-total-size' input: ${error.message}`);
                } else {
                    _core.setFailed(`Invalid 'max-total-size' input: ${String(error)}`);
                }
                return;
            }
        }
        const octokit = _github.getOctokit(token);
        const results = [];
        try {
            for(let i = 1; i <= 100; i += 1){
                const { data: cachesRequest } = await octokit.rest.actions.getActionsCacheList({
                    owner: _github.context.repo.owner,
                    repo: _github.context.repo.repo,
                    per_page: 100,
                    page: i
                });
                if (cachesRequest.actions_caches.length == 0) {
                    break;
                }
                results.push(...cachesRequest.actions_caches);
            }
        } catch (error) {
            console.log(`Failed to fetch caches: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        if (debug) {
            console.log(`Found ${results.length} caches`);
        }
        let totalSize = 0;
        results.forEach((cache)=>{
            totalSize += cache.size_in_bytes || 0;
        });
        if (debug) {
            console.log(`Total size of all caches: ${totalSize} bytes`);
            console.log(`Max total size: ${maxTotalSize} bytes`);
        }
        results.sort((a, b)=>(b.size_in_bytes || 0) - (a.size_in_bytes || 0));
        for (const cache of results){
            if (cache.last_accessed_at !== undefined && cache.created_at !== undefined && cache.id !== undefined) {
                const accessedAt = new Date(cache.last_accessed_at);
                const createdAt = new Date(cache.created_at);
                const accessedCondition = accessed && accessedAt < maxDate;
                const createdCondition = created && createdAt < maxDate;
                const sizeCondition = totalSize > maxTotalSize;
                if (accessedCondition || createdCondition || sizeCondition) {
                    if (debug) {
                        if (accessedCondition) {
                            console.log(`Deleting cache ${cache.key}, last accessed at ${accessedAt} before ${maxDate}`);
                        }
                        if (createdCondition) {
                            console.log(`Deleting cache ${cache.key}, created at ${createdAt} before ${maxDate}`);
                        }
                        if (sizeCondition) {
                            console.log(`Deleting cache ${cache.key}, total size ${totalSize} exceeds ${maxTotalSize}`);
                        }
                    }
                    try {
                        await octokit.rest.actions.deleteActionsCacheById({
                            per_page: 100,
                            owner: _github.context.repo.owner,
                            repo: _github.context.repo.repo,
                            cache_id: cache.id
                        });
                        totalSize -= cache.size_in_bytes || 0;
                    } catch (error) {
                        console.log(`Failed to delete cache ${cache.key};\n\n${error}`);
                    }
                } else if (debug) {
                    if (accessed) {
                        console.log(`Skipping cache ${cache.key}, last accessed at ${accessedAt} after ${maxDate}`);
                    }
                    if (created) {
                        console.log(`Skipping cache ${cache.key}, created at ${createdAt} after ${maxDate}`);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
        _core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();

//# sourceMappingURL=index.cjs.map