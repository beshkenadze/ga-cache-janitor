# Cache Janitor GitHub Action

Automatically purges GitHub Actions caches based on specified age and size limits to optimize workflow performance.

## Table of Contents

- [Overview](#overview)
- [Inputs](#inputs)
- [Usage](#usage)
  - [Basic Example](#basic-example)
  - [Advanced Example](#advanced-example)
- [Cache Deletion Criteria](#cache-deletion-criteria)
- [Debugging](#debugging)
- [Contributing](#contributing)
- [License](#license)

## Overview

Cache Janitor is a GitHub Action designed to help you manage your workflow caches effectively. Over time, caches can accumulate and consume significant storage space, potentially slowing down your workflows. This action allows you to set specific age and size limits to automatically purge old or large caches, ensuring optimal performance and efficient use of storage resources.

## Inputs

| Name             | Description                                                                                                                                  | Required | Default               |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------|----------|-----------------------|
| `debug`          | Set to `'true'` to enable detailed debug output during action execution.                                                                     | No       | `'false'`             |
| `max-age`        | Delete caches older than this value. Accepts formats like `'7d'` (days), `'1w'` (weeks), `'2M'` (months).                                    | No       | `'7d'`                |
| `max-total-size` | Maximum total size of caches to retain. Accepts formats like `'1GB'`, `'500MB'`, `'10TB'`.                                                   | No       | `'10GB'`              |
| `accessed`       | Set to `'true'` to delete caches based on their last accessed time.                                                                           | No       | `'true'`              |
| `created`        | Set to `'true'` to delete caches based on their creation time.                                                                                | No       | `'false'`             |
| `token`          | Used to communicate with the GitHub API. Typically not supplied by the user, as it defaults to `${{ github.token }}`.                         | No       | `${{ github.token }}` |

### Input Details

- **`debug`**: Enables verbose logging to help troubleshoot issues.
- **`max-age`**: Specifies the age threshold. Caches older than this value will be deleted.
- **`max-total-size`**: Sets the maximum allowable total cache size. Older caches will be deleted to maintain this limit.
- **`accessed`**: When `'true'`, caches are evaluated based on last accessed time.
- **`created`**: When `'true'`, caches are evaluated based on creation time.
- **`token`**: GitHub token for API authentication. Defaults to the automatically provided `github.token`.

## Usage

Add the Cache Janitor action to your workflow YAML file to start managing your caches.

### Basic Example

```yaml
name: Cache Cleanup

on:
  schedule:
    - cron: '0 0 * * 0' # Runs every Sunday at midnight

jobs:
  cache-cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: your-username/cache-janitor@v1
```

This basic setup uses default values to purge caches older than 7 days and maintain a total cache size under 10GB.

### Advanced Example

```yaml
name: Advanced Cache Cleanup

on:
  workflow_dispatch:

jobs:
  cache-cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Purge Old Caches
        uses: your-username/cache-janitor@v1
        with:
          debug: 'true'
          max-age: '14d'
          max-total-size: '5GB'
          accessed: 'true'
          created: 'true'
```

In this advanced example:

- **`debug`** is set to `'true'` to enable detailed logging.
- **`max-age`** is set to `'14d'`, so caches older than 14 days will be deleted.
- **`max-total-size`** is reduced to `'5GB'`.
- Both **`accessed`** and **`created`** are set to `'true'`, so the action considers both last accessed and creation times when purging caches.

## Cache Deletion Criteria

The action evaluates caches based on the following criteria:

1. **Age Limit (`max-age`)**: Caches older than the specified age are deleted.
2. **Total Size Limit (`max-total-size`)**: If the total size of caches exceeds this limit, the oldest caches are deleted first until the total size is under the limit.
3. **Accessed vs. Created Time (`accessed`, `created`)**:
   - **`accessed: 'true'`**: Uses the last accessed time of the cache.
   - **`created: 'true'`**: Uses the creation time of the cache.
   - If both are `'true'`, both criteria are considered when determining which caches to delete.

## Debugging

If you encounter issues or want more insight into the cache purging process, set the `debug` input to `'true'`:

```yaml
- uses: beshkenadze/cache-janitor@v3
  with:
    debug: 'true'
```

This will enable detailed logs that can help you understand the action's behavior and troubleshoot any problems.

## Contributing

Contributions are welcome! If you have suggestions for improvements or find bugs, please open an issue or submit a pull request.

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/YourFeature`
3. Commit your changes: `git commit -m 'Add YourFeature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Open a pull request.

Please make sure your code adheres to the existing code style and includes appropriate tests.

## License

This project is licensed under the [MIT License](LICENSE).
