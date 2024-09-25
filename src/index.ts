import * as core from "@actions/core";
import * as github from "@actions/github";

function setFailedWrongValue(input: string, value: string) {
  core.setFailed(`Wrong value for the input '${input}': ${value}`);
}

enum Inputs {
  Debug = "debug",
  MaxAge = "max-age",
  MaxTotalSize = "max-total-size",
  Accessed = "accessed",
  Created = "created",
  Token = "token",
}

export function parseHumanReadableTime(input: string): number {
  const match = input.match(/^(\d+)([dhwMy])$/);
  if (!match) {
    throw new Error(
      `Invalid time format: ${input}. Expected format like "7d", "1w", "2M", "1y".`
    );
  }
  const [, value, unit] = match;
  const numValue = parseInt(value, 10);
  switch (unit) {
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

export function parseHumanReadableSize(input: string): number {
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)$/i);
  if (!match) {
    const unitMatch = input.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
    if (unitMatch) {
      throw new Error(
        `Unknown size unit: ${unitMatch[2]}. Expected format like "500MB", "1.5GB", "10TB".`
      );
    }
    throw new Error(
      `Invalid size format: ${input}. Expected format like "500MB", "1.5GB", "10TB".`
    );
  }
  const [, value, unit] = match;
  const numValue = parseFloat(value);
  switch (unit.toUpperCase()) {
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

export async function run() {
  try {
    const debug = core.getInput(Inputs.Debug, { required: false }) === "true";
    const maxAgeInput = core.getInput(Inputs.MaxAge, { required: true });
    const maxTotalSizeInput = core.getInput(Inputs.MaxTotalSize, {
      required: false,
    });
    const accessed =
      core.getInput(Inputs.Accessed, { required: false }) === "true";
    const created =
      core.getInput(Inputs.Created, { required: false }) === "true";
    const token = core.getInput(Inputs.Token, { required: true });

    if (debug) {
      console.log(`Debug mode enabled`);
    }

    if (!maxAgeInput) {
      core.setFailed("Input 'max-age' is required and cannot be empty.");
      return;
    }

    if (!token) {
      core.setFailed("Input 'token' is required and cannot be empty.");
      return;
    }

    let maxAge: number;
    try {
      maxAge = parseHumanReadableTime(maxAgeInput);
    } catch (error: unknown) {
      if (error instanceof Error) {
        core.setFailed(`Invalid 'max-age' input: ${error.message}`);
      } else {
        core.setFailed(`Invalid 'max-age' input: An unknown error occurred`);
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
          core.setFailed(`Invalid 'max-total-size' input: ${error.message}`);
        } else {
          core.setFailed(`Invalid 'max-total-size' input: ${String(error)}`);
        }
        return;
      }
    }

    const octokit = github.getOctokit(token);

    interface Cache {
      id?: number | undefined;
      ref?: string | undefined;
      key?: string | undefined;
      version?: string | undefined;
      last_accessed_at?: string | undefined;
      created_at?: string | undefined;
      size_in_bytes?: number | undefined;
    }

    const results: Cache[] = [];
    try {
      for (let i = 1; i <= 100; i += 1) {
        const { data: cachesRequest } =
          await octokit.rest.actions.getActionsCacheList({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            per_page: 100,
            page: i,
          });

        if (cachesRequest.actions_caches.length == 0) {
          break;
        }

        results.push(...cachesRequest.actions_caches);
      }
    } catch (error) {
      console.log(
        `Failed to fetch caches: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return;
    }

    if (debug) {
      console.log(`Found ${results.length} caches`);
    }

    let totalSize = 0;
    results.forEach((cache) => {
      totalSize += cache.size_in_bytes || 0;
    });

    if (debug) {
      console.log(`Total size of all caches: ${totalSize} bytes`);
      console.log(`Max total size: ${maxTotalSize} bytes`);
    }

    results.sort((a, b) => (b.size_in_bytes || 0) - (a.size_in_bytes || 0));

    for (const cache of results) {
      if (
        cache.last_accessed_at !== undefined &&
        cache.created_at !== undefined &&
        cache.id !== undefined
      ) {
        const accessedAt = new Date(cache.last_accessed_at);
        const createdAt = new Date(cache.created_at);
        const accessedCondition = accessed && accessedAt < maxDate;
        const createdCondition = created && createdAt < maxDate;
        const sizeCondition = totalSize > maxTotalSize;

        if (accessedCondition || createdCondition || sizeCondition) {
          if (debug) {
            if (accessedCondition) {
              console.log(
                `Deleting cache ${cache.key}, last accessed at ${accessedAt} before ${maxDate}`
              );
            }
            if (createdCondition) {
              console.log(
                `Deleting cache ${cache.key}, created at ${createdAt} before ${maxDate}`
              );
            }
            if (sizeCondition) {
              console.log(
                `Deleting cache ${cache.key}, total size ${totalSize} exceeds ${maxTotalSize}`
              );
            }
          }

          try {
            await octokit.rest.actions.deleteActionsCacheById({
              per_page: 100,
              owner: github.context.repo.owner,
              repo: github.context.repo.repo,
              cache_id: cache.id,
            });
            totalSize -= cache.size_in_bytes || 0;
          } catch (error) {
            console.log(`Failed to delete cache ${cache.key};\n\n${error}`);
          }
        } else if (debug) {
          if (accessed) {
            console.log(
              `Skipping cache ${cache.key}, last accessed at ${accessedAt} after ${maxDate}`
            );
          }
          if (created) {
            console.log(
              `Skipping cache ${cache.key}, created at ${createdAt} after ${maxDate}`
            );
          }
        }
      }
    }
  } catch (error) {
    console.log(
      `An error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

run();
