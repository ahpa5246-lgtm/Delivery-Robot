// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StudioApp } from "@lichtblick/suite-base";
import AnalyticsProvider from "@lichtblick/suite-base/providers/AnalyticsProvider";
import { main } from "@lichtblick/suite-web";
import { WebRoot } from "@lichtblick/suite-web/src/WebRoot";

import { DeliveryAppBar } from "./delivery/DeliveryAppBar";

void main(async () => {
  const url = new URL(location.href);
  if (!url.searchParams.has("reference") && !url.searchParams.has("ds")) {
    url.searchParams.set("ds", "remote-file");
    url.searchParams.set("ds.url", new URL("/recordings/campus.mcap", url).href);
    history.replaceState(undefined, "", url);
  }
  return url.searchParams.has("reference")
    ? { extraProviders: [<AnalyticsProvider key="AnalyticsProvider" />] }
    : {
        rootElement: (
          <WebRoot
            extraProviders={[<AnalyticsProvider key="AnalyticsProvider" />]}
            dataSources={undefined}
            defaultColorScheme="dark"
            defaultTimeFormat="SEC"
            AppBarComponent={DeliveryAppBar}
          >
            <StudioApp />
          </WebRoot>
        ),
      };
});
