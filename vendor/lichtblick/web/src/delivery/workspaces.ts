// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";
import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

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
const scene = {
  followTf: "base_link",
  followMode: "follow-position",
  scene: {
    backgroundColor: "#08090b",
    meshUpAxis: "z_up",
    transforms: { showLabel: false, axisScale: 0.2, lineColor: "#4b5058" },
  },
  cameraState: {
    distance: 4,
    phi: 58,
    thetaOffset: 45,
    targetOffset: [0, 0, 0],
    near: 0.05,
  },
  topics: {
    "/robot_description": { visible: false },
    "/cdr01/path": {
      visible: true,
      type: "line",
      lineWidth: 0.035,
      gradient: ["#e6a85c", "#8d663d"],
    },
    "/odom": { visible: false },
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
    grid: {
      layerId: "foxglove.Grid",
      visible: true,
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
      "Plot!distance": plot(["distance_m"], "Travelled distance · m"),
    }),
  },
  {
    name: "Controls",
    data: data(split("Plot!motion", "RawMessages!odom", 60), {
      "Plot!motion": plot(["speed_mps"], "Recorded motion · no actuator commands"),
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
export function rebaseDeliveryAssets(layoutData: LayoutData, baseUrl: string): LayoutData | undefined {
  let next: LayoutData | undefined;
  for (const [id, config] of Object.entries(layoutData.configById)) {
    if (!id.startsWith("3D!")) {
      continue;
    }
    const layers = config.layers as typeof scene.layers | undefined;
    const model = layers?.delivery_robot;
    if (model?.deliveryAssetVersion !== 1) {
      continue;
    }
    const current = new URL("/models/cdr01.urdf", baseUrl).href;
    let oldPath: string;
    try {
      oldPath = new URL(model.url, baseUrl).pathname;
    } catch {
      continue;
    }
    if (oldPath !== "/models/cdr01.urdf" || model.url === current) {
      continue;
    }
    next ??= structuredClone(layoutData);
    (next.configById[id]!.layers as typeof scene.layers).delivery_robot.url = current;
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
