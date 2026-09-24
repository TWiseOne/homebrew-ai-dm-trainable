# Turn trace

The play session appends one JSON object per player turn to `data/play-traces/<gameId>.jsonl`.

Write the file during the turn. A missing field is `null` plus a `gaps` entry. Do not invent a roll, a broker id, or an engine total to fill a gap.

```json
{
  "traceVersion": 1,
  "gameId": "uuid",
  "turnIndex": 0,
  "at": "ISO-8601",
  "campaignId": "tiny-return-the-object",
  "rulesetId": "dnd-5e-2024",
  "rulesVersion": "srd-5.2.1",
  "sceneId": "gate",
  "actorId": "aria",
  "controllerKind": "human",
  "playerText": "I shoulder the door.",
  "context": {
    "scene": "short scene text actually sent",
    "visibleFactIds": ["f1"],
    "omitted": "dm_only facts and unused scenes"
  },
  "modelIntent": {
    "mode": "resolve",
    "resolutionChoice": "resolution_8f27",
    "narration": "text before the roll resolves, or empty",
    "factProposals": []
  },
  "brokerOptions": [
    {
      "id": "resolution_8f27",
      "requirement": "optional",
      "applicability": "force the door",
      "rollOwner": "human",
      "engine": "check"
    }
  ],
  "roll": {
    "status": "resolved",
    "owner": "human",
    "method": "manual_raw_die",
    "natural": 12,
    "modifier": 3,
    "total": 15,
    "dc": 15,
    "success": true
  },
  "engineResult": {
    "events": ["CHECK_REQUESTED", "CHECK_RESOLVED"],
    "stateDelta": ["no HP change"]
  },
  "authorityReview": {
    "disposition": "allow",
    "reason": "ephemeral_presentation"
  },
  "finalNarration": "The door gives.",
  "humanLabel": null,
  "gaps": []
}
```

`humanLabel` stays `null` until the user sets `good`, `bad`, or `corrected`. A `corrected` turn also stores `correction` with the narration or choice they wanted.

`roll.status` is `none`, `awaiting_player_roll`, or `resolved`. While it is `awaiting_player_roll`, `finalNarration` must not state success, failure, damage, or the total.

If one player utterance needs initiative and then an attack, `roll` is the resolving roll and `engineResult.earlierRolls` lists the earlier dice, including engine-owned NPC dice.

`roll.owner` is `human` or `engine`. `roll.method` is `digital_button`, `manual_raw_die`, `engine`, or `none`.

`mode` is `narrate`, `resolve`, or `reject`. `resolve` must cite an id present in `brokerOptions`.

Do not put these traces in `training/datasets/`, `dm-training/exports/`, or `evals/`.
