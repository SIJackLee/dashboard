import "server-only";

import { packCtrlProtocol, packFarmProtocol } from "@/lib/aria/protocol/pack";
import {
  heuristicCtrlJudge,
  heuristicFarmJudge,
  parseCtrlJudge,
  parseFarmJudge,
} from "@/lib/aria/protocol/parse-judge";
import {
  chatReplyWithOpenAI,
  judgeProtocolWithOpenAI,
} from "@/lib/aria/protocol/openai";
import { chatHeuristicReply } from "@/lib/aria/protocol/chat-heuristic";
import {
  ariaProtocolV1Enabled,
  isBareRecommend,
  isFragmentQuestion,
  isMoreQuestion,
  isWhoControllerQuestion,
  resolveDepthReq,
  routeByRules,
  wantsCriticalOnly,
  wantsThresholdEdit,
} from "@/lib/aria/protocol/route";
import {
  emptyAriaSession,
  type AriaProtocolResult,
  type AriaRoute,
  type AriaSession,
} from "@/lib/aria/protocol/types";
import {
  unpackBareRecommendClarify,
  unpackCtrlJudge,
  unpackFarmJudge,
  unpackFragmentClarify,
  unpackMoreAtCeiling,
  unpackThresholdRefuse,
} from "@/lib/aria/protocol/unpack";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

export { ariaProtocolV1Enabled, routeByRules };

export async function runAriaProtocol(args: {
  question: string;
  facts: VoiceFarmFacts | null;
  session: AriaSession | null;
  useOpenAI: boolean;
  /** 사전 라우팅 힌트 (CHAT facts 스킵용). 없으면 규칙 재계산 */
  route?: AriaRoute;
}): Promise<AriaProtocolResult> {
  const sessionIn = args.session ?? emptyAriaSession();
  const route = args.route ?? routeByRules(args.question);

  if (route === "CHAT") {
    let text: string;
    let source: AriaProtocolResult["source"] = "chat";
    if (args.useOpenAI) {
      try {
        text = await chatReplyWithOpenAI(args.question);
      } catch {
        text = chatHeuristicReply(args.question);
        source = "protocol_heuristic";
      }
    } else {
      text = chatHeuristicReply(args.question);
      source = "protocol_heuristic";
    }
    return {
      text,
      route: "CHAT",
      source,
      session: {
        ...sessionIn,
        lastRoute: "CHAT",
      },
    };
  }

  if (!args.facts) {
    return {
      text: "농장 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      route,
      source: "protocol_heuristic",
      session: { ...sessionIn, lastRoute: route },
    };
  }

  const facts = args.facts;

  if (route === "CTRL") {
    if (wantsThresholdEdit(args.question)) {
      return {
        text: unpackThresholdRefuse(),
        route: "CTRL",
        source: "protocol_heuristic",
        session: {
          depth: sessionIn.depth,
          focusStallType: sessionIn.focusStallType,
          focusStallNo: sessionIn.focusStallNo,
          lastRoute: "CTRL",
        },
      };
    }

    if (isBareRecommend(args.question)) {
      return {
        text: unpackBareRecommendClarify(),
        route: "CTRL",
        source: "protocol_heuristic",
        session: {
          depth: sessionIn.depth,
          focusStallType: sessionIn.focusStallType,
          focusStallNo: sessionIn.focusStallNo,
          lastRoute: "CTRL",
        },
      };
    }

    const pack = packCtrlProtocol({
      question: args.question,
      facts,
    });
    let judge = heuristicCtrlJudge(facts);
    let source: AriaProtocolResult["source"] = "protocol_heuristic";

    if (args.useOpenAI) {
      try {
        const raw = await judgeProtocolWithOpenAI(pack);
        const parsed = parseCtrlJudge(raw);
        if (parsed) {
          judge = parsed;
          source = "protocol";
        }
      } catch {
        /* heuristic keep */
      }
    }

    return {
      text: unpackCtrlJudge(judge, facts),
      route: "CTRL",
      source,
      session: {
        depth: sessionIn.depth,
        focusStallType: sessionIn.focusStallType,
        focusStallNo: sessionIn.focusStallNo,
        lastRoute: "CTRL",
      },
    };
  }

  // FARM
  if (isFragmentQuestion(args.question)) {
    return {
      text: unpackFragmentClarify(args.question),
      route: "FARM",
      source: "protocol_heuristic",
      session: {
        depth: sessionIn.depth,
        focusStallType: sessionIn.focusStallType,
        focusStallNo: sessionIn.focusStallNo,
        lastRoute: "FARM",
      },
    };
  }

  const depthReq = resolveDepthReq(args.question, sessionIn);
  const moreStep =
    isMoreQuestion(args.question) &&
    sessionIn.lastRoute === "FARM" &&
    sessionIn.depth >= 1 &&
    sessionIn.depth < 4;

  if (
    isMoreQuestion(args.question) &&
    sessionIn.lastRoute === "FARM" &&
    sessionIn.depth >= 4 &&
    depthReq === 4
  ) {
    return {
      text: unpackMoreAtCeiling(),
      route: "FARM",
      source: "protocol_heuristic",
      session: {
        depth: 4,
        focusStallType: sessionIn.focusStallType,
        focusStallNo: sessionIn.focusStallNo,
        lastRoute: "FARM",
      },
    };
  }

  const pack = packFarmProtocol({
    question: args.question,
    depthReq,
    facts,
    session: sessionIn,
  });

  let judge = heuristicFarmJudge(facts, depthReq, args.question);
  let source: AriaProtocolResult["source"] = "protocol_heuristic";

  if (args.useOpenAI) {
    try {
      const raw = await judgeProtocolWithOpenAI(pack);
      const parsed = parseFarmJudge(raw);
      if (parsed) {
        judge = {
          ...parsed,
          depth: depthReq,
          say:
            parsed.say.length > 0
              ? parsed.say
              : heuristicFarmJudge(facts, depthReq, args.question).say,
        };
        source = "protocol";
      }
    } catch {
      /* heuristic */
    }
  }

  const text = unpackFarmJudge(judge, facts, {
    seed: args.question,
    criticalOnly: wantsCriticalOnly(args.question),
    moreStep,
    whoController: isWhoControllerQuestion(args.question),
  });

  return {
    text,
    route: "FARM",
    source,
    session: {
      depth: depthReq,
      focusStallType: judge.focusStallType,
      focusStallNo: judge.focusStallNo,
      lastRoute: "FARM",
    },
  };
}
