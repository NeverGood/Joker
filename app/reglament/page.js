import ScoreboardShell from '../../components/ScoreboardShell';

const ruleBlocks = [
  {
    eyebrow: 'Раздачи',
    lead: 'Партия рассчитана на четырех игроков и состоит из 24 раздач.',
    items: [
      'Первый блок: 1, 2, 3, 4, 5, 6, 7, 8 карт.',
      'Второй блок: четыре раздачи по 9 карт.',
      'Третий блок: 8, 7, 6, 5, 4, 3, 2, 1 карт.',
      'Последний блок: четыре раздачи по 9 карт.'
    ],
    notes: [
      'При раздаче по 9 карт козырь заказывается игроком, который первый заказывает взятку, из первых трех сданных ему карт.',
      'Если вместо козыря на столе выпадет джокер или игрок на 9 картах заказывает "безкозырку" - то играется партия без козырей, где все масти равносильны.'
    ]
  },
  {
    eyebrow: 'Очередность',
    lead: 'Раздающий меняется по кругу: игрок 4, игрок 1, игрок 2, игрок 3, затем цикл повторяется.',
    items: [
      'Заказ идет по кругу после раздающего.',
      'Раздающий делает заказ последним.',
      'Последнему заказчику нельзя назвать число, при котором сумма всех заказов ровно равна количеству карт в раздаче.'
    ]
  },
  {
    eyebrow: 'Розыгрыш',
    lead: 'После розыгрыша в таблицу заносится фактическое количество взяток каждого игрока.',
    items: [
      'Сумма всех взяток должна совпадать с количеством карт в раздаче.',
      'Если раздача на 7 карт, суммарно должно быть записано ровно 7 взяток.',
      'Таблица подсвечивает ошибку, если сумма взяток не сходится.'
    ]
  },
  {
    eyebrow: 'Счет',
    lead: 'Базовая цена заказа считается по формуле: 50 * (заказ + 1).',
    items: [
      'Если игрок взял меньше заказа, он получает минус цену заказа.',
      'Если игрок взял ровно заказ, он получает плюс цену заказа.',
      'Если игрок заказал и взял все карты, он получает количество карт * 100.',
      'Если игрок взял больше заказа, он получает количество взяток * 10.'
    ],
    examples: true
  },
  {
    eyebrow: 'Премия',
    lead: 'Премия считается отдельно для каждого блока раздач.',
    items: [
      'Игрок претендует на премию, если во всех раздачах блока взял ровно столько, сколько заказал.',
      'Премия равна: (очки игрока в последней раздаче блока + лучший положительный результат следующего игрока в этом блоке) * 2.',
      'У следующего игрока выбранный лучший результат срезается из итога блока.',
      'Если следующий игрок тоже премиальный, его последняя раздача не используется для среза.'
    ]
  },
  {
    eyebrow: 'Джокер',
    lead: 'В игре есть 2 джокера. Джокер очень сильная карта которая может изменить ход игры.',
    items: [
      'Джокер можно кидать в любой момент своего хода, например что бы перебить любой козырь игрока.',
      'Так же при своем ходе джокер может сделать заказ хода.',
      'Например сказать что берет определенная масть: при этом если масти нет, игрок обязан кинуть козырь и забрать взятку.',
      'Так же можно потребовать скинуть старший козырь или младшую масть и т.д.',
      'Можно скинуть джокер в любой момент что бы не бить карту на столе.',
      'Второй джокер может перебить первый джокер.'
    ]
  }
];

const examples = [
  {
    label: 'Заказ 3, взял 3',
    value: '+200'
  },
  {
    label: 'Заказ 3, взял 2',
    value: '-200'
  },
  {
    label: 'Заказ 3, взял 5',
    value: '+50'
  },
  {
    label: 'На 8 картах заказал 8 и взял 8',
    value: '+800'
  }
];

const punishmentTypes = [
  {
    title: 'Штраф',
    variant: 'fine',
    accent: '-250',
    text: 'Назначается за грубое нарушение правил и влечет за собой -250 очков в общий счет игрока. Назначение штрафа не влияет на возможность получения премии.'
  },
  {
    title: 'Точка',
    variant: 'point',
    text: 'Выноситься предупреждение за незначительные нарушения правил или тупость. Получение трех точек влечет за собой физическое наказание в виде пощечины от всех остальных участников игры. Сила и способ нанесение пощечины остается на усмотрение бьющего, и не может расцениваться никак иначе, кроме как заслуженное наказание принимающего пощечину. В случае если в один игровой день играется более одной игры, то все точки переносятся между играми.'
  }
];

const punishmentRules = [
  {
    title: 'Не дал подснять',
    penalty: 'Штраф',
    tone: 'fine',
    text: 'Грубое нарушение, считается если раздающий сдал первую карту, не дав подснять предыдущему игроку. Наказывается Штрафом и последующей пересдачей.'
  },
  {
    title: 'Побил карту другой мастью или козырем при наличии такой масти на руке',
    penalty: 'Штраф',
    tone: 'fine',
    text: 'Грубое нарушение, наказывается Штрафом и пересдачей этой раздачи.'
  },
  {
    title: 'Неверно раздал карты',
    penalty: 'Штраф / Точка',
    tone: 'mixed',
    text: 'Грубое нарушение. Наказывается Штрафом если открыли козыря. Наказывается Точкой если сдающий заметил неверное кол-во карт до открытия козыря и происходит перерасдача.'
  },
  {
    title: 'Сдал карты не в свой ход',
    penalty: 'Точка',
    tone: 'point',
    text: 'Нарушение которое наказывается Точкой игроку который неверно сдал, и происходит перерасдача. Нарушение может быть специально спровоцированно.'
  },
  {
    title: 'Кинул карту не в свой ход',
    penalty: 'Точка',
    tone: 'point',
    text: 'Нарушение, наказывается Точкой, так как может повлиять на решение других игроков.'
  },
  {
    title: 'Переспросил козырь более 1 раза при наличии козыря на столе',
    penalty: 'Точка',
    tone: 'point',
    text: 'Наказывается Точкой за тупость.'
  },
  {
    title: 'Заказал взятку не в свой ход',
    penalty: 'Точка',
    tone: 'point',
    text: 'Наказывается Точкой, так как может повлиять на решение других игроков.'
  },
  {
    title: 'Затягивание игры',
    penalty: 'Точка',
    tone: 'point',
    text: 'Слишком долгие раздумья и тупки, наказывается Точкой если все остальные игроки приняли решение что раздумья и тупки излишне долгие. Долгими не считаются раздумья меньше минуты.'
  }
];

export const metadata = {
  title: 'Регламент | Joker Bus-Angeles Edition',
  description: 'Правила раздач, заказов, подсчета очков, премий и штрафов в Joker Bus-Angeles Edition.'
};

export default function ReglamentPage() {
  return (
    <ScoreboardShell active="reglament">
      <section className="reglamentHero panelCard panelCardWide">
        <h1 className="sectionTitle">Регламент</h1>
      </section>

      <details className="archivePanel reglamentRulesPanel">
        <summary className="reglamentRulesSummary">
          <span>История</span>
        </summary>
      </details>

      <details className="archivePanel reglamentRulesPanel" open>
        <summary className="reglamentRulesSummary">
          <span>Правила</span>
        </summary>
        <div className="reglamentGrid" aria-label="Правила игры">
          {ruleBlocks.map((block) => (
            <article className="reglamentBlock" key={block.eyebrow}>
              <p className="sectionEyebrow">{block.eyebrow}</p>
              <p>{block.lead}</p>
              <ul>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {block.notes?.map((note) => (
                <p key={note}>{note}</p>
              ))}
              {block.examples ? (
                <div className="reglamentInlineExamples" aria-label="Примеры подсчета очков">
                  <p className="sectionEyebrow">Примеры подсчета</p>
                  <div className="reglamentInlineExamplesGrid">
                    {examples.map((example) => (
                      <div className="reglamentInlineExample" key={example.label}>
                        <span>{example.label}</span>
                        <strong>{example.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </details>

      <details className="archivePanel reglamentRulesPanel reglamentPunishmentPanel" open>
        <summary className="reglamentRulesSummary">
          <span>Штрафы и наказания</span>
        </summary>
        <div className="reglamentTextBlock reglamentPunishmentBody">
          <div className="reglamentPunishmentIntro">
            <p>
              В игре существует несколько наказаний за нарушение правил игры или невнимательность. Данный регламент
              описывает наказание в конкретных ситуациях и разъясняет спорные ситуации.
            </p>
          </div>
          <div className="reglamentPunishmentTypes" aria-label="Основные виды наказаний">
            {punishmentTypes.map((item) => (
              <article className={`reglamentPunishmentType reglamentPunishmentType-${item.variant}`} key={item.title}>
                <div className="reglamentPunishmentTypeHeader">
                  <div>
                    <h2>{item.title}</h2>
                    {item.accent ? <span className="reglamentPunishmentAccent">{item.accent}</span> : null}
                  </div>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="reglamentPunishmentCasesHeader">
            <p className="sectionEyebrow">Ситуации</p>
            <h2>Когда назначается наказание</h2>
          </div>
          <ol className="reglamentPunishmentList">
            {punishmentRules.map((item) => (
              <li className="reglamentPunishmentRule" key={item.title}>
                <div className="reglamentPunishmentRuleTop">
                  <strong>{item.title}</strong>
                  <span className={`reglamentPunishmentChip reglamentPunishmentChip-${item.tone}`}>
                    {item.penalty}
                  </span>
                </div>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </ScoreboardShell>
  );
}
