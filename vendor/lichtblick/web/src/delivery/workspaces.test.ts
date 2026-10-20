// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { describe, it, expect, jest } from "@jest/globals";

import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import { ensureWorkspaces, workspacePresets, rebaseDeliveryAssets } from "./workspaces";
import { DELIVERY_VIEWS, deliveryViewLayers, deliveryViewCamera } from "./viewPresets";

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
      updateLayout: jest.fn<ILayoutManager["updateLayout"]>(async ({ data }) => ({
        ...existing,
        baseline: { data: data ?? existing.baseline.data, savedAt: undefined },
      })),
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
    expect(layouts[0]).not.toBe(existing);
    expect((layouts[0]!.baseline.data.configById["3D!delivery"] as {
      layers: { delivery_campus: { visible: boolean }; delivery_logistics: { visible: boolean } };
    }).layers.delivery_campus.visible).toBe(true);
    expect(manager.saveNewLayout).toHaveBeenCalledTimes(4);
    expect(manager.updateLayout).toHaveBeenCalledTimes(1);
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
  const environmentLayers = config.layers as typeof config.layers & {
    delivery_campus: { url: string };
    delivery_logistics: { url: string };
  };
  environmentLayers.delivery_campus.url = "http://new-cloud-host/models/environment/native-campus.urdf";
  environmentLayers.delivery_logistics.url = "http://new-cloud-host/models/environment/native-logistics.urdf";
  expect(rebaseDeliveryAssets(preset, "http://new-cloud-host/")).toBeUndefined();
});

it("migrates only Delivery-tagged old 3D panels, leaving camera and mission panel data intact", () => {
  const layout = structuredClone(workspacePresets[4]!.data);
  const delivery = layout.configById["3D!delivery"] as {
    layers: Record<string, unknown>;
    cameraState: { distance: number };
  };
  delivery.cameraState.distance = 8.5;
  delete delivery.layers.delivery_campus;
  delete delivery.layers.delivery_logistics;
  const missionBefore = JSON.stringify(layout.configById["DeliveryMissions!delivery"]);
  const migrated = rebaseDeliveryAssets(layout, "http://localhost:8080/")!;
  const layers = (migrated.configById["3D!delivery"] as typeof delivery).layers as Record<string, {url: string; visible: boolean}>;
  expect(layers.delivery_campus!.url).toBe("http://localhost:8080/models/environment/native-campus.urdf");
  expect(layers.delivery_campus!.visible).toBe(true);
  expect(layers.delivery_logistics!.visible).toBe(false);
  expect((migrated.configById["3D!delivery"] as typeof delivery).cameraState.distance).toBe(8.5);
  expect(JSON.stringify(migrated.configById["DeliveryMissions!delivery"])).toBe(missionBefore);
  expect(delivery.layers.delivery_campus).toBeUndefined();
});

it("native scenery presets are exclusive, use realistic overview zoom, and never hide the robot", () => {
  expect(DELIVERY_VIEWS).toEqual(["robot", "campus", "logistics", "grid"]);
  for (const name of DELIVERY_VIEWS) {
    const flags = deliveryViewLayers(name);
    expect(Object.values(flags).filter(Boolean)).toHaveLength(name === "robot" ? 0 : 1);
    expect(deliveryViewCamera[name].distance).toBeGreaterThan(5);
  }
  expect(deliveryViewCamera.campus.distance).toBeGreaterThan(20);
  expect(deliveryViewCamera.campus.targetOffset).toEqual([16, 10, 0]);
  expect(deliveryViewCamera.logistics.targetOffset).toEqual([16, 10, 0]);
  // Southwest overview keeps the rear/east warehouse walls behind the scenery.
  expect(deliveryViewCamera.logistics.thetaOffset).toBe(45);
  expect(deliveryViewCamera.campus.thetaOffset).toBe(225);
  const initial = workspacePresets[0]!.data.configById["3D!delivery"] as {
    layers: { grid: { visible: boolean }; delivery_campus: { visible: boolean }; delivery_robot: { visible: boolean } };
    cameraState: { distance: number };
  };
  expect(initial.layers.delivery_robot.visible).toBe(true);
  expect(initial.layers.delivery_campus.visible).toBe(true);
  expect(initial.layers.grid.visible).toBe(false);
  expect(initial.cameraState.distance).toBeGreaterThan(20);
});
