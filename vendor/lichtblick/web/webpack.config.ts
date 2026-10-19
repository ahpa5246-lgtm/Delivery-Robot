// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CopyPlugin from "copy-webpack-plugin";
import path from "path";

import {
  ConfigParams,
  devServerConfig,
  mainConfig,
} from "@lichtblick/suite-web/src/webpackConfigs";

import packageJson from "../package.json";

const params: ConfigParams = {
  outputPath: path.resolve(__dirname, ".webpack"),
  contextPath: path.resolve(__dirname, "src"),
  entrypoint: "./entrypoint.tsx",
  prodSourceMap: "source-map",
  version: packageJson.version,
};

// foxglove-depcheck-used: webpack-dev-server
const appConfig: ReturnType<typeof mainConfig> = (env, argv) => {
  const config = mainConfig(params)(env, argv);
  config.plugins = [
    ...(config.plugins ?? []),
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, "../LICENSE"), to: "licenses/LICHTBLICK-MPL-2.0.txt" },
        { from: path.resolve(__dirname, "../../../docs/licenses"), to: "licenses/fonts" },
        {
          from: path.resolve(__dirname, "../../../docs/THIRD_PARTY_NOTICES.md"),
          to: "licenses/THIRD_PARTY_NOTICES.md",
        },
        {
          from: path.resolve(__dirname, "../../../integrations/upstream_samples/rbot-nav2/LICENSE"),
          to: "licenses/RBOT-Apache-2.0.txt",
        },
        {
          from: path.resolve(__dirname, "../../../artifacts/campus.mcap"),
          to: "recordings/campus.mcap",
        },
        {
          from: path.resolve(__dirname, "../../../assets/robot/cdr01-lichtblick.urdf"),
          to: "models/cdr01.urdf",
        },
        ...["rbot-chassis.stl", "rbot-wheel.stl"].map((name) => ({
          from: path.resolve(__dirname, "../../../dashboard/assets/robot", name),
          to: `models/${name}`,
        })),
      ],
    }),
  ];
  return config;
};
export default [devServerConfig(params), appConfig];
