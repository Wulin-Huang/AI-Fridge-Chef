"""Prompt 模板集中管理。

设计原则：
1. 不在代码或 prompt 中硬编码菜系列表 / 菜名 / 食材库，一切由模型发挥；
2. 每次请求注入随机"灵感因子"（时令 / 场景 / 风格），避免相同输入产生相同输出；
3. 输出统一为 JSON，由 deepseek.chat_json 解析。
"""

import random

CHEF_SYSTEM = (
    "你是一位兼具创意与烟火气的私厨顾问，精通世界各地的家常料理。"
    "你从不套模板，总能根据现有食材给出让人眼前一亮的搭配。"
    "所有输出必须是合法 JSON，字段名与用户要求完全一致，不要输出任何多余文字。"
)

NUTRITIONIST_SYSTEM = (
    "你是一位务实的注册营养师，擅长用通俗语言评估家常菜的营养结构。"
    "所有输出必须是合法 JSON，不要输出任何多余文字。"
)

VISION_SYSTEM = (
    "你是一位经验丰富的厨房食材识别专家，能从照片中准确辨认各类生鲜食材、"
    "调味品和包装食品。所有输出必须是合法 JSON，不要输出任何多余文字。"
)

FRIDGE_DOCTOR_SYSTEM = (
    "你是一位既懂营养学又懂生活方式的冰箱健康管理师，善于从食材组合看出"
    "一个家庭的饮食结构问题，点评专业、直接、不说套话，偶尔带点幽默。"
    "所有输出必须是合法 JSON，不要输出任何多余文字。"
)


def fridge_health_prompt(ingredients: list[str]) -> str:
    return (
        f"这是我冰箱里的全部食材：{', '.join(ingredients)}。\n"
        "请从营养学角度给这个冰箱做一次体检，要求：\n"
        "1. 综合评级 A/B/C/D（A=非常均衡，D=严重偏科）；\n"
        "2. 指出营养亮点（如蛋白质充足）和明显缺口（如绿叶菜不足、几乎没有碳水）；\n"
        "3. 给出 3 条具体的补充采购或饮食调整建议；\n"
        "4. 用一句不超过 20 字的话总结这个冰箱的气质。\n"
        '输出 JSON：{"grade":"A","summary":"一句话气质","highlights":["亮点"],"gaps":["缺口"],'
        '"advice":["建议1","建议2","建议3"]}，所有内容用中文，highlights 和 gaps 各 2-3 条。'
    )

CRITIQUE_SYSTEM = (
    "你是一位幽默又不失专业的美食评审兼烹饪教练，善于从成品的色泽、摆盘、"
    "质感判断烹饪完成度，给出中肯的鼓励与改进建议。语气轻松接地气，像朋友聊天。"
    "所有输出必须是合法 JSON，不要输出任何多余文字。"
)


def critique_prompt(recipe_name: str) -> str:
    name_note = f"（这道菜应该是：{recipe_name}）" if recipe_name else ""
    return (
        f"请点评这张菜品的成品照片{name_note}，要求：\n"
        "1. 从色泽、摆盘、质感/完成度三个维度观察；\n"
        "2. 评分 60~100 的整数（家常菜标准，别太苛刻）；\n"
        '3. 输出 JSON：{"score":85,"verdict":"一句话总评","highlights":["亮点1","亮点2"],'
        '"improvements":["改进建议1","改进建议2"]}，'
        "verdict/highlights/improvements 全部用中文，highlights 和 improvements 各 2 条以内。"
    )


def recognize_ingredients_prompt(known: list[str]) -> str:
    known_note = f"我已经有这些食材，无需重复列出：{', '.join(known)}。" if known else ""
    return (
        "请识别这张照片中所有可食用的食材，要求：\n"
        "1. 使用常见中文食材名（如西红柿、鸡蛋、牛腩、小葱）；\n"
        "2. 只列食材本体，忽略餐具、砧板、背景等非食物；\n"
        "3. 不确定的食材不要猜测；\n"
        f"4. {known_note}\n"
        '5. 输出 JSON：{"ingredients":[{"name":"食材名","confidence":0.95}]}，'
        "confidence 为识别置信度 0~1 的小数。"
    )


def _spark() -> str:
    """随机灵感因子：让每次生成的方向自然错开。"""
    dimensions = [
        "考虑当前季节的时令搭配",
        "偏向省事快手的做法",
        "偏向有仪式感的慢料理",
        "带一点异国风味灵感",
        "突出食材本味的清淡路线",
        "适合下饭的浓郁路线",
        "适合一人食的精致小份",
        "适合全家分享的大盘菜",
        "考虑隔夜菜少、现做现吃",
        "考虑减脂增肌人群需求",
    ]
    return random.choice(dimensions)


def ingredient_suggestions_prompt(current: list[str]) -> tuple[str, str]:
    if current:
        user = (
            f"我冰箱里已经有这些食材：{', '.join(current)}。\n"
            "请给我一份食材采购与联想建议，帮我补充搭配食材。要求：\n"
            "1. 生成 5 到 6 个分类，分类名自拟（可结合已有食材联想，比如已有牛腩可以联想炖煮配料）；\n"
            "2. 每个分类 6 到 8 个常见于中国家庭厨房的食材；\n"
            "3. 优先推荐与已有食材能组合成菜的；\n"
            '4. 输出 JSON：{"categories":[{"name":"分类名","items":["食材1","食材2"]}]}'
        )
    else:
        user = (
            "我的冰箱空了，准备去采购。请给我一份食材建议，要求：\n"
            "1. 生成 5 到 6 个分类，分类名自拟，覆盖蔬菜、肉蛋、主食、调味等方向，但具体分类由你决定；\n"
            "2. 每个分类 6 到 8 个常见于中国家庭厨房的食材；\n"
            '3. 输出 JSON：{"categories":[{"name":"分类名","items":["食材1","食材2"]}]}'
        )
    return CHEF_SYSTEM, user


def recipe_styles_prompt(ingredients: list[str]) -> tuple[str, str]:
    user = (
        f"我冰箱里有：{', '.join(ingredients)}。\n"
        "请生成 6 个『今日做菜风格灵感』，供我挑选，要求：\n"
        "1. 每个灵感是一个具体风格方向，名称要有画面感（4-8 个字），并配一个 emoji；\n"
        "2. 风格要多样化且贴合这些食材能做出的方向，不要千篇一律；\n"
        "3. 附一句话说明这个风格适合什么场景。\n"
        '4. 输出 JSON：{"styles":[{"name":"风格名","emoji":"🍳","desc":"一句话说明"}]}'
    )
    return CHEF_SYSTEM, user


def recipe_generate_prompt(
    ingredients: list[str],
    style: str,
    servings: int,
    preferences: str,
    excluded: list[str],
    count: int = 3,
) -> tuple[str, str]:
    excluded_note = (
        f"我最近已经做过这些菜，请避开：{', '.join(excluded)}。" if excluded else ""
    )
    user = (
        f"我的冰箱里有这些食材：{', '.join(ingredients)}。\n"
        f"用餐人数：{servings} 人。\n"
        f"想做的大致风格：{style}。\n"
        f"口味或忌口：{preferences or '无特别要求'}。\n"
        f"{excluded_note}\n"
        f"生成提示：{_spark()}。\n\n"
        f"请推荐 {count} 道此刻最适合做的菜，要求：\n"
        "1. 以现有食材为主料，允许少量常见调味料和辅料；\n"
        "2. 几道菜要有差异（做法、口味或场景不同），菜名具体有吸引力；\n"
        "3. 难度分为 简单/中等/进阶；每道菜标注 emoji、预计耗时（分钟）、估算热量（千卡/整道）；\n"
        "4. 每道菜给出用料表（名称+用量）、步骤（5-8 步，口语化但专业）、2-3 条小贴士；\n"
        "5. 标注哪些用料是冰箱里已有的、哪些需要另外购买（is_in_fridge 布尔值）；\n"
        "6. 附一段 30 字左右的推荐理由。\n"
        '输出 JSON：{"recipes":[{"name":"","emoji":"","cuisine":"","difficulty":"","time_minutes":0,'
        '"calories":0,"description":"","reason":"","ingredients":[{"name":"","amount":"","is_in_fridge":true}],'
        '"steps":[""],"tips":[""]}]}'
    )
    return CHEF_SYSTEM, user


def nutrition_prompt(recipe_name: str, ingredients_desc: str, servings: int) -> tuple[str, str]:
    user = (
        f"请分析这道菜的营养情况：{recipe_name}（{servings} 人份）。\n"
        f"主要用料：{ingredients_desc}。\n"
        "给出整道菜的热量、蛋白质、碳水、脂肪、膳食纤维估算（含单位说明），"
        "一段通俗的营养点评和 2 条改进建议。\n"
        '输出 JSON：{"calories":"","protein":"","carbs":"","fat":"","fiber":"","analysis":"","suggestions":[""]}'
    )
    return NUTRITIONIST_SYSTEM, user


def meal_plan_prompt(
    ingredients: list[str],
    days: int,
    servings: int,
    preferences: str,
    meals: list[str] | None = None,
) -> tuple[str, str]:
    meal_types = "、".join(meals) if meals else "午餐和晚餐"
    user = (
        f"我的冰箱里有：{', '.join(ingredients)}。\n"
        f"请规划未来 {days} 天的家庭菜单，每天安排{meal_types}，用餐人数 {servings} 人。\n"
        f"口味偏好：{preferences or '无特别要求'}。生成提示：{_spark()}。\n"
        "要求：\n"
        "1. 优先消耗现有食材，但可以建议少量采购补充；\n"
        "2. 每天的菜要荤素搭配、不重样，标注每道菜用到的冰箱食材和需采购食材；\n"
        "3. 每天附一句整体的搭配思路。\n"
        '输出 JSON：{"days":[{"day":1,"idea":"搭配思路","meals":[{"type":"午餐","dishes":[{"name":"","emoji":"",'
        '"use_ingredients":[""],"missing_ingredients":[""]}]}]}],"grocery_summary":["补充采购建议"]}'
    )
    return CHEF_SYSTEM, user


def grocery_prompt(target_dishes: list[str], current_ingredients: list[str]) -> tuple[str, str]:
    user = (
        f"我想做这几道菜：{', '.join(target_dishes)}。\n"
        f"我冰箱里已经有：{', '.join(current_ingredients) or '基本是空的'}。\n"
        "请生成一份购物清单，只列出做这些菜真正缺少的东西：\n"
        "1. 每项含名称、建议购买量、分类（自拟分类，如蔬果/肉蛋/调味）、推荐原因；\n"
        "2. 已有的食材不要重复列出；\n"
        '3. 输出 JSON：{"items":[{"name":"","amount":"","category":"","reason":""}]}'
    )
    return CHEF_SYSTEM, user
