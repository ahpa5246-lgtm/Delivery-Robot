// SPDX-FileCopyrightText: Copyright (C) 2026 Delivery-Robot contributors
// SPDX-License-Identifier: MPL-2.0
// Presentation presets act only on native renderer settings; MCAP/TF/robot data is untouched.

import type { CameraState } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";

export type DeliveryView = "robot" | "campus" | "logistics" | "grid";

export const DELIVERY_VIEWS: readonly DeliveryView[] = ["robot", "campus", "logistics", "grid"];

// Angles and distance are the native Lichtblick camera parameters, in degrees/metres.
// Environment modes use the stationary odom frame and target the map centre (16,10).
// Robot focus retains the moving base_link frame; no recorded transform is rewritten.
export const deliveryViewCamera: Record<DeliveryView, Partial<CameraState>> = {
  robot: { distance: 6.8, phi: 58, thetaOffset: 225, targetOffset: [0, 0, 0], near: 0.05 },
  campus: { distance: 28, phi: 52, thetaOffset: 225, targetOffset: [16, 10, 0], near: 0.1 },
  logistics: { distance: 28, phi: 52, thetaOffset: 225, targetOffset: [16, 10, 0], near: 0.1 },
  grid: { distance: 29, phi: 53, thetaOffset: 225, targetOffset: [16, 10, 0], near: 0.1 },
};

export function deliveryViewLayers(view: DeliveryView): Record<
  "delivery_campus" | "delivery_logistics" | "grid",
  boolean
> {
  return {
    delivery_campus: view === "campus",
    delivery_logistics: view === "logistics",
    grid: view === "grid",
  };
}
