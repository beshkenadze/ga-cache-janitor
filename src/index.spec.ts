import * as core from "@actions/core";
import * as github from "@actions/github";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseHumanReadableSize, parseHumanReadableTime, run } from "./index"; // Assuming the main function is exported as 'run'

describe("GitHub Actions Cache Cleanup", () => {
  beforeEach(() => {
    vi.mock("@actions/core");
    vi.mock("@actions/github");

    // Mock GITHUB_REPOSITORY environment variable
    process.env.GITHUB_REPOSITORY = "test-owner/test-repo";
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.GITHUB_REPOSITORY;
  });

  describe("parseHumanReadableTime", () => {
    it("should correctly parse days", () => {
      expect(parseHumanReadableTime("7d")).toBe(7 * 24 * 60 * 60);
    });

    it("should correctly parse hours", () => {
      expect(parseHumanReadableTime("24h")).toBe(24 * 60 * 60);
    });

    it("should correctly parse weeks", () => {
      expect(parseHumanReadableTime("2w")).toBe(2 * 7 * 24 * 60 * 60);
    });

    it("should correctly parse months", () => {
      expect(parseHumanReadableTime("3M")).toBe(3 * 30 * 24 * 60 * 60);
    });

    it("should correctly parse years", () => {
      expect(parseHumanReadableTime("1y")).toBe(365 * 24 * 60 * 60);
    });

    it("should throw an error for invalid format", () => {
      expect(() => parseHumanReadableTime("invalid")).toThrow(
        "Invalid time format"
      );
    });

    it("should throw an error for unknown unit", () => {
      expect(() => parseHumanReadableSize("5PB")).toThrow(
        'Unknown size unit: PB. Expected format like "500MB", "1.5GB", "10TB".'
      );
    });
  });

  describe("parseHumanReadableSize", () => {
    it("should correctly parse KB", () => {
      expect(parseHumanReadableSize("500KB")).toBe(500 * 1024);
    });

    it("should correctly parse MB", () => {
      expect(parseHumanReadableSize("1.5MB")).toBe(1.5 * 1024 * 1024);
    });

    it("should correctly parse TB", () => {
      expect(parseHumanReadableSize("1TB")).toBe(1024 * 1024 * 1024 * 1024);
    });

    it("should be case-insensitive", () => {
      expect(parseHumanReadableSize("500kb")).toBe(500 * 1024);
    });

    it("should throw an error for invalid format", () => {
      expect(() => parseHumanReadableSize("invalid")).toThrow(
        "Invalid size format"
      );
    });

    it("should throw an error for unknown unit", () => {
      expect(() => parseHumanReadableSize("5PB")).toThrow("Unknown size unit");
    });
  });

  describe("run", () => {
    it("should delete caches based on age and size", async () => {
      // Mock input values
      vi.spyOn(core, "getInput").mockImplementation((name) => {
        switch (name) {
          case "debug":
            return "true";
          case "max-age":
            return "7d";
          case "max-total-size":
            return "1GB";
          case "accessed":
            return "true";
          case "created":
            return "true";
          case "token":
            return "fake-token";
          default:
            return "";
        }
      });

      // Mock GitHub API responses
      let callCount = 0;
      const mockOctokit = {
        rest: {
          actions: {
            getActionsCacheList: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: {
                    actions_caches: [
                      {
                        id: 1,
                        key: "cache1",
                        last_accessed_at: "2023-01-01T00:00:00Z",
                        created_at: "2023-01-01T00:00:00Z",
                        size_in_bytes: 500 * 1024 * 1024,
                      },
                      {
                        id: 2,
                        key: "cache2",
                        last_accessed_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        size_in_bytes: 600 * 1024 * 1024,
                      },
                    ],
                  },
                });
              } else {
                return Promise.resolve({ data: { actions_caches: [] } });
              }
            }),
            deleteActionsCacheById: vi.fn().mockResolvedValue({}),
          },
        },
      };
      vi.spyOn(github, "getOctokit").mockReturnValue(mockOctokit as any);

      // Run the function
      await run();

      // Assertions
      expect(
        mockOctokit.rest.actions.getActionsCacheList
      ).toHaveBeenCalledTimes(2);
      expect(
        mockOctokit.rest.actions.getActionsCacheList
      ).toHaveBeenNthCalledWith(1, {
        owner: "test-owner",
        repo: "test-repo",
        per_page: 100,
        page: 1,
      });
      expect(
        mockOctokit.rest.actions.getActionsCacheList
      ).toHaveBeenNthCalledWith(2, {
        owner: "test-owner",
        repo: "test-repo",
        per_page: 100,
        page: 2,
      });

      // Update this assertion to expect 2 calls
      expect(
        mockOctokit.rest.actions.deleteActionsCacheById
      ).toHaveBeenCalledTimes(2);

      // Check that both caches were deleted
      expect(
        mockOctokit.rest.actions.deleteActionsCacheById
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          cache_id: 1,
        })
      );
      expect(
        mockOctokit.rest.actions.deleteActionsCacheById
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          cache_id: 2,
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      // Mock input values
      vi.spyOn(core, "getInput").mockImplementation((name) => {
        switch (name) {
          case "max-age":
            return "7d";
          case "token":
            return "fake-token";
          default:
            return "";
        }
      });

      // Mock GitHub API responses
      const mockOctokit = {
        rest: {
          actions: {
            getActionsCacheList: vi
              .fn()
              .mockRejectedValue(new Error("API Error")),
          },
        },
      };
      vi.spyOn(github, "getOctokit").mockReturnValue(mockOctokit as any);

      // Mock console.log to capture output
      const consoleLogSpy = vi.spyOn(console, "log");

      // Run the function
      await run();

      // Assertions
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch caches: API Error")
      );
    });

    it("should respect the debug flag", async () => {
      // Mock input values
      vi.spyOn(core, "getInput").mockImplementation((name) => {
        switch (name) {
          case "debug":
            return "true";
          case "max-age":
            return "7d";
          case "token":
            return "fake-token";
          default:
            return "";
        }
      });
      // Mock GitHub API responses
      const mockOctokit = {
        rest: {
          actions: {
            getActionsCacheList: vi.fn().mockResolvedValue({
              data: {
                actions_caches: [],
              },
            }),
          },
        },
      };
      vi.spyOn(github, "getOctokit").mockReturnValue(mockOctokit as any);

      // Mock console.log to capture output
      const consoleLogSpy = vi.spyOn(console, "log");

      // Run the function
      await run();

      // Assertions
      expect(consoleLogSpy).toHaveBeenCalledWith("Debug mode enabled");
      expect(consoleLogSpy).toHaveBeenCalledWith("Found 0 caches");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Total size of all caches: 0 bytes"
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Max total size: Infinity bytes"
      );
    });
  });
});
