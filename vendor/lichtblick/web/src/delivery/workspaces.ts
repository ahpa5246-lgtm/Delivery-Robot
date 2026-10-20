// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";
import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import { deliveryViewCamera } from "./viewPresets";

const plot = (fields: string[], title: string) => ({
  title,
  paths: fields.map((field, i) => ({
    value: `/cdr01/mission.${field}`,
    enabled: true,
    timestampMethod: "receiveTime",
    label: field,
    color: ["#e6a85c", "#a7b9cc", "#bb98cf"][i % 3],
  })),
  xAxisVal: "timestamp",
  showLegend: true,
  legendDisplay: "top",
  showPlotValuesInLegend: true,
  showXAxisLabels: true,
  showYAxisLabels: true,
  isSynced: true,
  sidebarDimension: 180,
});
const environmentLayer = (name: "campus" | "logistics", visible: boolean) => ({
  deliveryEnvironmentVersion: 1,
  layerId: "foxglove.Urdf" as const,
  visible,
  frameLocked: true,
  label: name === "campus" ? "University campus · visual scenery" : "Logistics warehouse · visual scenery",
  sourceType: "url" as const,
  url: `/models/environment/native-${name}.urdf`,
  framePrefix: "",
  displayMode: "visual" as const,
});

const scene = {
  followTf: "odom",
  followMode: "follow-position",
  scene: {
    backgroundColor: "#08090b",
    meshUpAxis: "z_up",
    transforms: { showLabel: false, axisScale: 0.2, lineColor: "#4b5058" },
  },
  cameraState: {
    ...deliveryViewCamera.campus,
  },
  topics: {
    "/robot_description": { visible: false },
    "/cdr01/path": {
      visible: true,
      type: "line",
      lineWidth: 0.035,
      gradient: ["#e6a85c", "#8d663d"],
    },
    "/cdr01/planned_path": {
      visible: true,
      type: "line",
      lineWidth: 0.055,
      gradient: ["#5bd5c5", "#118c81"],
    },
    "/odom": { visible: false },
    "/cdr01/dynamic_obstacle": { visible: true },
  },
  layers: {
    delivery_robot: {
      deliveryAssetVersion: 1,
      layerId: "foxglove.Urdf",
      visible: true,
      frameLocked: true,
      label: "CDR visual CAD assembly · not mechanical validation",
      sourceType: "url",
      url: "/models/cdr01.urdf",
      framePrefix: "",
      displayMode: "visual",
    },
    delivery_campus: environmentLayer("campus", true),
    delivery_logistics: environmentLayer("logistics", false),
    grid: {
      layerId: "foxglove.Grid",
      visible: false,
      size: 30,
      divisions: 30,
      color: "#454951",
      position: [0, 0, 0],
    },
  },
};
function data(layout: LayoutData["layout"], configById: LayoutData["configById"]): LayoutData {
  return {
    layout,
    configById,
    globalVariables: {},
    playbackConfig: { ...defaultPlaybackConfig },
  };
}
const split = (first: string, second: string, splitPercentage = 65) => ({
  first,
  second,
  direction: "row" as const,
  splitPercentage,
});
export const workspacePresets = [
  {
    name: "Perception",
    data: data(
      {
        first: "3D!delivery",
        second: {
          first: "Plot!speed",
          second: "RawMessages!odom",
          direction: "column",
          splitPercentage: 45,
        },
        direction: "row",
        splitPercentage: 70,
      },
      {
        "3D!delivery": scene,
        "Plot!speed": plot(["speed_mps"], "Replay speed · m/s"),
        "RawMessages!odom": { topicPath: "/odom" },
      },
    ),
  },
  {
    name: "Planning",
    data: data(split("3D!delivery", "Plot!distance"), {
      "3D!delivery": scene,
      "Plot!distance": plot(["distance_m", "minimum_clearance_m"], "Distance and static/dynamic clearance · m"),
    }),
  },
  {
    name: "Controls",
    data: data(split("Plot!motion", "RawMessages!odom", 60), {
      "Plot!motion": plot(["speed_mps", "obstacle_range_m"], "Speed and modeled sensor range"),
      "RawMessages!odom": { topicPath: "/odom" },
    }),
  },
  {
    name: "Diagnostics",
    data: data(
      {
        first: "StateTransitions!phase",
        second: {
          first: "RawMessages!mission",
          second: "Plot!energy",
          direction: "row",
          splitPercentage: 50,
        },
        direction: "column",
        splitPercentage: 40,
      },
      {
        "StateTransitions!phase": {
          isSynced: true,
          paths: ["phase", "status"].map((field) => ({
            value: `/cdr01/mission.${field}`,
            enabled: true,
            timestampMethod: "receiveTime",
          })),
        },
        "RawMessages!mission": { topicPath: "/cdr01/mission" },
        "Plot!energy": plot(
          ["energy_estimated_wh", "soc_estimated"],
          "Estimated energy · not measured telemetry",
        ),
      },
    ),
  },
  {
    name: "Missions",
    data: data(split("DeliveryMissions!delivery", "3D!delivery", 42), {
      "DeliveryMissions!delivery": {},
      "3D!delivery": scene,
    }),
  },
];

// Rebase only our tagged bundled model. A user's other URDF URL stays untouched.
// Migrate only Delivery-tagged panels. Preserve edits to cameras, topics and all
// user-provided URDFs; do not reset or replace native saved layouts.
export function rebaseDeliveryAssets(layoutData: LayoutData, baseUrl: string): LayoutData | undefined {
  let next: LayoutData | undefined;
  const ownedAssets = [
    ["delivery_robot", "/models/cdr01.urdf", "deliveryAssetVersion"],
    ["delivery_campus", "/models/environment/native-campus.urdf", "deliveryEnvironmentVersion"],
    ["delivery_logistics", "/models/environment/native-logistics.urdf", "deliveryEnvironmentVersion"],
  ] as const;
  for (const [id, config] of Object.entries(layoutData.configById)) {
    if (!id.startsWith("3D!")) {
      continue;
    }
    const layers = config.layers as typeof scene.layers | undefined;
    if (layers?.delivery_robot?.deliveryAssetVersion !== 1) {
      continue;
    }
    const changed: Record<string, object> = {};
    for (const [key, assetPath, marker] of ownedAssets) {
      const layer = layers[key] as
        | { url: string; deliveryAssetVersion?: number; deliveryEnvironmentVersion?: number }
        | undefined;
      const canonical = new URL(assetPath, baseUrl).href;
      if (!layer && key !== "delivery_robot") {
        changed[key] = { ...scene.layers[key], url: canonical };
        continue;
      }
      if (!layer || layer[marker] !== 1) {
        continue;
      }
      try {
        if (new URL(layer.url, baseUrl).pathname !== assetPath || layer.url === canonical) {
          continue;
        }
      } catch {
        continue;
      }
      changed[key] = { ...layer, url: canonical };
    }
    if (Object.keys(changed).length > 0) {
      next ??= structuredClone(layoutData);
      const editable = next.configById[id] as { layers: typeof scene.layers };
      editable.layers = { ...editable.layers, ...changed } as typeof scene.layers;
    }
  }
  return next;
}

export async function ensureWorkspaces(
  manager: Pick<ILayoutManager, "getLayouts" | "saveNewLayout" | "updateLayout">,
  baseUrl: string,
): Promise<Layout[]> {
  const existing = await manager.getLayouts();
  return await Promise.all(
    workspacePresets.map(async (preset) => {
      const name = `Delivery · ${preset.name}`;
      const resolvedData: LayoutData = {
        ...preset.data,
        configById: {
          ...preset.data.configById,
          ...(preset.data.configById["3D!delivery"]
            ? {
                "3D!delivery": {
                  ...scene,
                  layers: {
                    ...scene.layers,
                    delivery_robot: {
                      ...scene.layers.delivery_robot,
                      url: new URL("/models/cdr01.urdf", baseUrl).href,
                    },
                    delivery_campus: {
                      ...scene.layers.delivery_campus,
                      url: new URL("/models/environment/native-campus.urdf", baseUrl).href,
                    },
                    delivery_logistics: {
                      ...scene.layers.delivery_logistics,
                      url: new URL("/models/environment/native-logistics.urdf", baseUrl).href,
                    },
                  },
                },
              }
            : {}),
        },
      };
      const retained = existing.find((layout) => layout.name === name);
      if (retained) {
        const rebased = rebaseDeliveryAssets(
          retained.working?.data ?? retained.baseline.data,
          baseUrl,
        );
        return rebased && retained.permission === "CREATOR_WRITE"
          ? await manager.updateLayout({ id: retained.id, data: rebased })
          : retained;
      }
      return await manager.saveNewLayout({ name, data: resolvedData, permission: "CREATOR_WRITE" });
    }),
  );
}
