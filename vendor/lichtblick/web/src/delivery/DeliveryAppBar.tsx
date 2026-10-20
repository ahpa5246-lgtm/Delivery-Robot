// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Button, Menu, MenuItem, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
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
import { DEFAULT_CAMERA_STATE } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import type { CameraState } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";

import { ensureWorkspaces, workspacePresets } from "./workspaces";
import { deliveryViewCamera, deliveryViewLayers, DELIVERY_VIEWS } from "./viewPresets";
import type { DeliveryView } from "./viewPresets";

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

let viewRequestSequence = 0;

export function DeliveryAppBar(props: AppBarProps): React.JSX.Element {
  const { classes } = useStyles();
  const manager = useLayoutManager();
  const { sidebarActions } = useWorkspaceActions();
  const selectedId = useCurrentLayoutSelector((state) => state.selectedLayout?.id);
  const active3DConfig = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.configById["3D!delivery"],
  );
  const { setSelectedLayoutId, getCurrentLayoutState, savePanelConfigs, updateSharedPanelState } =
    useCurrentLayoutActions();
  const [viewAnchor, setViewAnchor] = useState<HTMLElement | null>(null);
  const activeLayers = active3DConfig?.layers as
    | { delivery_robot?: { deliveryAssetVersion?: number }; delivery_campus?: {visible?: boolean}; delivery_logistics?: {visible?: boolean}; grid?: {visible?: boolean} }
    | undefined;
  const viewAvailable = activeLayers?.delivery_robot?.deliveryAssetVersion === 1;
  const activeView: DeliveryView = activeLayers?.delivery_logistics?.visible
    ? "logistics"
    : activeLayers?.grid?.visible && !activeLayers?.delivery_campus?.visible
      ? "grid"
      : activeLayers?.delivery_campus?.visible ? "campus" : "robot";

  const applyEnvironmentView = (view: DeliveryView) => {
    const selected = getCurrentLayoutState().selectedLayout;
    const current = selected?.data?.configById["3D!delivery"];
    const currentLayers = current?.layers as typeof activeLayers;
    if (selected?.id == undefined || !current ||
        currentLayers?.delivery_robot?.deliveryAssetVersion !== 1) {
      return;
    }
    const flags = deliveryViewLayers(view);
    const nextLayers = { ...currentLayers } as Record<string, unknown>;
    for (const [key, visible] of Object.entries(flags)) {
      const layer = nextLayers[key] as Record<string, unknown> | undefined;
      if (layer) {
        nextLayers[key] = { ...layer, visible };
      }
    }
    const followTf = view === "robot" ? "base_link" : "odom";
    const cameraState: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...(current.cameraState as Partial<CameraState> | undefined),
      ...deliveryViewCamera[view],
    };
    // Native layout persistence is the source of truth for the *selected* panel only.
    savePanelConfigs({
      configs: [{
        id: "3D!delivery",
        config: { ...current, layers: nextLayers, followTf, cameraState },
        override: true,
      }],
    });
    // Persisting a native config alone does not update the mounted ThreeDee renderer;
    // issue a scoped transient command so it updates the live WebGL instance too.
    updateSharedPanelState("3D", {
      cameraState,
      followMode: (current.followMode as "follow-position") ?? "follow-position",
      followTf,
      deliveryViewRequest: {
        id: ++viewRequestSequence,
        layoutId: selected.id,
        panelId: "3D!delivery",
        view,
      },
    });
    setViewAnchor(null);
  };
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

        <Button
          size="small"
          variant="outlined"
          aria-label="Environment view"
          disabled={!viewAvailable}
          onClick={(event: MouseEvent<HTMLButtonElement>) => setViewAnchor(event.currentTarget)}
        >
          Environment view: {activeView}
        </Button>
        <Menu anchorEl={viewAnchor} open={viewAnchor != undefined}
          onClose={() => setViewAnchor(null)}>
          {DELIVERY_VIEWS.map((view) => (
            <MenuItem
              key={view}
              selected={activeView === view}
              onClick={() => applyEnvironmentView(view)}
            >
              {view === "robot" ? "Robot focus" : view === "campus" ? "University campus"
                : view === "logistics" ? "Logistics warehouse" : "Grid only"}
            </MenuItem>
          ))}
        </Menu>
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
