// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { describe, it, expect, jest } from "@jest/globals";

import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import { ensureWorkspaces, workspacePresets, rebaseDeliveryAssets } from "./workspaces";

describe("Delivery workspaces", () => {
  it("provides five native layouts without inventing sensor topics", () => {
    expect(workspacePresets.map((p) => p.name)).toEqual([
      "Perception",
      "Planning",
      "Controls",
      "Diagnostics",
      "Missions",
    ]);
    expect(JSON.stringify(workspacePresets)).not.toMatch(/lidar|gps|camera_topic/i);
  });
  it("preserves existing layouts and only seeds missing presets", async () => {
    const existing: Layout = {
      id: "custom" as Layout["id"],
      name: "Delivery · Perception",
      baseline: { data: structuredClone(workspacePresets[0]!.data), savedAt: undefined },
      permission: "CREATOR_WRITE",
      working: undefined,
      syncInfo: undefined,
    };
    (existing.baseline.data.configById["3D!delivery"] as {
      layers: { delivery_robot: { url: string } };
    }).layers.delivery_robot.url = "http://127.0.0.1:8081/models/cdr01.urdf";
    const manager = {
      updateLayout: jest.fn<ILayoutManager["updateLayout"]>(),
      getLayouts: jest.fn<ILayoutManager["getLayouts"]>().mockResolvedValue([existing]),
      saveNewLayout: jest.fn<ILayoutManager["saveNewLayout"]>(async (p) => ({
        ...p,
        id: p.name as Layout["id"],
        baseline: { data: p.data, savedAt: undefined },
        working: undefined,
        syncInfo: undefined,
      })),
    };
    const layouts = await ensureWorkspaces(manager, "http://127.0.0.1:8081/");
    expect(layouts[0]).toBe(existing);
    expect(manager.saveNewLayout).toHaveBeenCalledTimes(4);
    expect(manager.updateLayout).not.toHaveBeenCalled();
    expect(manager.saveNewLayout).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: existing.name }),
    );
  });
});

it("rebases only the tagged bundled robot asset while preserving user model URLs", () => {
  const preset = structuredClone(workspacePresets[0]!.data);
  const config = preset.configById["3D!delivery"] as {
    layers: { delivery_robot: { url: string } };
  };
  config.layers.delivery_robot.url = "http://old-cloud-host/models/cdr01.urdf";
  const migrated = rebaseDeliveryAssets(preset, "http://new-cloud-host/");
  expect((migrated!.configById["3D!delivery"] as typeof config).layers.delivery_robot.url).toBe(
    "http://new-cloud-host/models/cdr01.urdf",
  );
  expect(config.layers.delivery_robot.url).toBe("http://old-cloud-host/models/cdr01.urdf");
  config.layers.delivery_robot.url = "https://user-assets.test/another-robot.urdf";
  expect(rebaseDeliveryAssets(preset, "http://new-cloud-host/")).toBeUndefined();
});
