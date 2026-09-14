import { fetch as request } from "undici";
import { settings } from "../config/settings";

type TokenResult = {
  accessToken?: string;
};

export class NoticeService {
  private readonly enabled =
    settings.notice.enabled &&
    Boolean(
      settings.notice.clientId &&
        settings.notice.clientSecret &&
        settings.notice.conversationId,
    );

  async send(message: string) {
    if (!this.enabled) {
      return;
    }

    const tokenResponse = await request(
      "https://api.dingtalk.com/v1.0/oauth2/accessToken",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appKey: settings.notice.clientId,
          appSecret: settings.notice.clientSecret,
        }),
      },
    );
    const token = (await tokenResponse.json()) as TokenResult;
    if (!token.accessToken) {
      throw new Error("notice token unavailable");
    }

    const response = await request(
      "https://api.dingtalk.com/v1.0/robot/groupMessages/send",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-acs-dingtalk-access-token": token.accessToken,
        },
        body: JSON.stringify({
          msgKey: "sampleMarkdown",
          msgParam: JSON.stringify({ title: "任务异常", text: message }),
          openConversationId: settings.notice.conversationId,
          robotCode: settings.notice.clientId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`notice request failed: ${response.status}`);
    }
  }
}
