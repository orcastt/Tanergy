"""update geekai model whitelist

Revision ID: a00000000005
Revises: a00000000004
Create Date: 2026-04-26
"""

from alembic import op


revision = "a00000000005"
down_revision = "a00000000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DELETE FROM model_configs
        WHERE provider = 'geekai'
          AND model IN (
            'gpt-5-mini', 'gpt-5', 'gpt-4o', 'gpt-4o-mini',
            'gemini-2.5-pro', 'gemini-2.5-flash', 'deepseek-chat',
            'nano-banana-pro', 'doubao-seedream-4-0', 'gpt-image-1.5'
          );
    """)
    op.execute("""
        WITH values_table(provider, model, display_name, call_type, credits_per_call, sort_order) AS (
            VALUES
            ('geekai', 'hunyuan-3.0-preview',        'Hunyuan 3.0 Preview',      'chat',          1,  0),
            ('geekai', 'minimax-m2.7:free',          'MiniMax M2.7 Free',        'chat',          1,  1),
            ('geekai', 'nemotron-3-super-120b-a12b', 'Nemotron 3 Super 120B',    'chat',          1,  2),
            ('geekai', 'gpt-image-2',                'GPT-Image-2',              'image',         8,  20),
            ('geekai', 'nano-banana-2',              'Nano Banana 2',            'image',         5,  21),
            ('geekai', 'nano-banana-hd',             'Nano Banana HD',           'image',         8,  22),
            ('geekai', 'jimeng_t2i_v40',             'Jimeng Image 4.0',         'image',         5,  23),
            ('geekai', 'gemini-nano-banana',         'Gemini Nano Banana',       'image_edit',    6,  40),
            ('geekai', 'gpt-image-1',                'GPT-Image-1',              'image_edit',    6,  41),
            ('geekai', 'jimeng-image-enhance-v2',    'Jimeng Image Enhance v2',  'image_enhance', 3,  60)
        )
        UPDATE model_configs m
        SET display_name = v.display_name,
            call_type = v.call_type,
            credits_per_call = v.credits_per_call,
            sort_order = v.sort_order,
            is_active = true
        FROM values_table v
        WHERE m.provider = v.provider AND m.model = v.model;
    """)
    op.execute("""
        INSERT INTO model_configs (id, provider, model, display_name, call_type, credits_per_call, sort_order)
        SELECT gen_random_uuid(), v.provider, v.model, v.display_name, v.call_type, v.credits_per_call, v.sort_order
        FROM (VALUES
            ('geekai', 'hunyuan-3.0-preview',        'Hunyuan 3.0 Preview',      'chat',          1,  0),
            ('geekai', 'minimax-m2.7:free',          'MiniMax M2.7 Free',        'chat',          1,  1),
            ('geekai', 'nemotron-3-super-120b-a12b', 'Nemotron 3 Super 120B',    'chat',          1,  2),
            ('geekai', 'gpt-image-2',                'GPT-Image-2',              'image',         8,  20),
            ('geekai', 'nano-banana-2',              'Nano Banana 2',            'image',         5,  21),
            ('geekai', 'nano-banana-hd',             'Nano Banana HD',           'image',         8,  22),
            ('geekai', 'jimeng_t2i_v40',             'Jimeng Image 4.0',         'image',         5,  23),
            ('geekai', 'gemini-nano-banana',         'Gemini Nano Banana',       'image_edit',    6,  40),
            ('geekai', 'gpt-image-1',                'GPT-Image-1',              'image_edit',    6,  41),
            ('geekai', 'jimeng-image-enhance-v2',    'Jimeng Image Enhance v2',  'image_enhance', 3,  60)
        ) AS v(provider, model, display_name, call_type, credits_per_call, sort_order)
        WHERE NOT EXISTS (
            SELECT 1 FROM model_configs m
            WHERE m.provider = v.provider AND m.model = v.model
        );
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM model_configs
        WHERE provider = 'geekai'
          AND model IN (
            'hunyuan-3.0-preview', 'minimax-m2.7:free',
            'nemotron-3-super-120b-a12b', 'nano-banana-hd',
            'gemini-nano-banana', 'jimeng-image-enhance-v2'
          );
    """)
