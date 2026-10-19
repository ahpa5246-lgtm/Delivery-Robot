// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Button, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { AppBar, AppBarProps } from "@lichtblick/suite-base/components/AppBar";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import { ensureWorkspaces, workspacePresets } from "./workspaces";

const useStyles = makeStyles()(() => ({
  bar: {
    minHeight: 38,
    padding: "0 12px",
    backgroundColor: "#08090b",
    borderBottom: "1px solid #292c31",
    overflowX: "auto",
    flexShrink: 0,
  },
  brand: { fontWeight: 700, whiteSpace: "nowrap", letterSpacing: 1.2 },
  tabs: {
    minHeight: 36,
    "& .MuiTab-root": {
      minHeight: 36,
      minWidth: 84,
      padding: "4px 12px",
      fontSize: 12,
    },
  },
  source: { color: "#c4a47e", whiteSpace: "nowrap" },
  button: { whiteSpace: "nowrap", fontSize: 11 },
  spacer: { flexGrow: 1 },
}));

export function DeliveryAppBar(props: AppBarProps): React.JSX.Element {
  const { classes } = useStyles();
  const manager = useLayoutManager();
  const { sidebarActions } = useWorkspaceActions();
  const selectedId = useCurrentLayoutSelector((state) => state.selectedLayout?.id);
  const { setSelectedLayoutId } = useCurrentLayoutActions();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void ensureWorkspaces(manager, location.href)
      .then((items) => {
        if (!active) {
          return;
        }
        setLayouts(items);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(String(cause));
        }
      });
    return () => {
      active = false;
    };
  }, [manager, setSelectedLayoutId]);
  useEffect(() => {
    if (
      layouts.length === 0 ||
      selectedId == undefined ||
      localStorage.getItem("delivery.workspace.initialized.v1")
    ) {
      return;
    }
    if (!new URL(location.href).searchParams.has("layout")) {
      setSelectedLayoutId(layouts[0]!.id);
      sidebarActions.left.setOpen(false);
    }
    localStorage.setItem("delivery.workspace.initialized.v1", "true");
  }, [layouts, selectedId, setSelectedLayoutId, sidebarActions]);
  const declaredSource = useMessagePipeline(
    (ctx) => ctx.getMetadata().find((item) => item.name === "delivery.provenance")?.metadata.source,
  );
  return (
    <>
      <AppBar {...props} />
      <Stack direction="row" alignItems="center" spacing={1} className={classes.bar}>
        <Typography variant="overline" className={classes.brand}>
          DELIVERY ROBOT
        </Typography>
        <Tabs
          value={layouts.some((item) => item.id === selectedId) ? selectedId : false}
          onChange={(_event, id: Layout["id"]) => {
            setSelectedLayoutId(id);
          }}
          className={classes.tabs}
          aria-label="Delivery workspaces"
        >
          {layouts.map((item, index) => (
            <Tab key={item.id} value={item.id} label={workspacePresets[index]?.name} />
          ))}
        </Tabs>
        <div className={classes.spacer} />
        <Typography variant="caption" className={classes.source}>
          {declaredSource === "campus_kinematic_replay"
            ? "DECLARED: modeled replay"
            : "SOURCE: inspect native data details"}
        </Typography>
        <Button
          size="small"
          className={classes.button}
          onClick={() => {
            const target = new URL(location.href);
            target.searchParams.set("ds", "remote-file");
            target.searchParams.set(
              "ds.url",
              new URL("/recordings/campus.mcap", location.href).href,
            );
            location.assign(target.href);
          }}
        >
          Load modeled demo
        </Button>
      </Stack>
      {error != undefined && (
        <Alert severity="error">Workspace storage: {error}. Native layouts remain available.</Alert>
      )}
    </>
  );
}
