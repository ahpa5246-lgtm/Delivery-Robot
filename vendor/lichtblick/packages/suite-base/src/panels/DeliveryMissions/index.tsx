// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Divider, Stack, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useMessagesByTopic } from "@lichtblick/suite-base/PanelAPI";
import Panel from "@lichtblick/suite-base/components/Panel";

const useStyles = makeStyles()(() => ({
  root: { padding: 16, overflow: "auto", height: "100%" },
}));

const TOPIC = "/cdr01/mission";

function DeliveryMissions(): React.JSX.Element {
  const { classes } = useStyles();
  const messages = useMessagesByTopic({ topics: [TOPIC], historySize: 1 });
  const message = messages[TOPIC]?.[0]?.message;
  const state =
    message != undefined && typeof message === "object"
      ? (message as Record<string, unknown>)
      : undefined;
  const text = (field: string) =>
    state?.[field] == undefined
      ? "—"
      : typeof state[field] === "string"
        ? state[field]
        : JSON.stringify(state[field]);
  const number = (field: string, unit: string, scale = 1) =>
    typeof state?.[field] === "number" ? `${(state[field] * scale).toFixed(2)} ${unit}` : "—";
  return (
    <Stack spacing={2} className={classes.root}>
      <div>
        <Typography variant="overline" color="text.secondary">
          DELIVERY OPERATIONS
        </Typography>
        <Typography variant="h5">Mission playback</Typography>
      </div>
      {state == undefined ? (
        <Alert severity="info">
          No mission message at the current playback time. Open a compatible recording containing{" "}
          {TOPIC}.
        </Alert>
      ) : (
        <>
          <Alert severity={state.source === "campus_kinematic_replay" ? "warning" : "info"}>
            Source: {text("source")}.{" "}
            {state.source === "campus_kinematic_replay"
              ? "Modeled kinematic replay; energy and state of charge are estimates. No live robot connection."
              : "Verify recording provenance before interpreting these values."}
          </Alert>
          <Typography variant="h4">{text("phase")}</Typography>
          <Typography color="text.secondary">Status: {text("status")}</Typography>
          <Divider />
          {[
            ["Recording time", number("timestamp_s", "s")],
            ["Speed", number("speed_mps", "m/s")],
            ["Travelled distance", number("distance_m", "m")],
            ["Estimated energy", number("energy_estimated_wh", "Wh")],
            ["Estimated state of charge", number("soc_estimated", "%", 100)],
          ].map(([label, value]) => (
            <Stack key={label} direction="row" justifyContent="space-between" spacing={2}>
              <Typography color="text.secondary">{label}</Typography>
              <Typography fontFamily="monospace">{value}</Typography>
            </Stack>
          ))}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Synchronized to native playback and seeking through {TOPIC}. This panel does not command
            a robot or synthesize sensor readings.
          </Typography>
        </>
      )}
    </Stack>
  );
}
DeliveryMissions.panelType = "DeliveryMissions";
DeliveryMissions.defaultConfig = {};
export default Panel(DeliveryMissions);
