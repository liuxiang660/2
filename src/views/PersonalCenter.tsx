import React, { useEffect, useState } from 'react';
import { User, SlidersHorizontal, Save, RotateCcw, Upload, History, CheckCircle2, AlertTriangle, Download, Plus, Trash2 } from 'lucide-react';
import { getCurrentUser } from '../utils/authService';
import { notifyAction } from '../utils/notify';
import { downloadCsvFile } from '../utils/actions';
import {
  fetchProductPortrait,
  fetchProductPortraitOptions,
  rollbackProductPortraitVersion,
  saveProductPortraitConfig,
  saveProductPortraitRows as persistProductPortraitRows,
  ProductProfileConfig,
  PortraitRow,
  PortraitVersion,
} from '../utils/productPortraitService';

interface ImportError {
  line: number;
  message: string;
}

const defaultIndustryOptions = ['消费电子', '汽车制造', '新能源', '医疗器械', '跨境电商'];
const defaultRegionOptions = ['亚太', '北美', '欧洲', '中东', '拉美', '非洲'];
const defaultSupplyStageOptions = ['生产制造', '港口码头', '仓储配送', '末端派送'];

const defaultConfig: ProductProfileConfig = {
  focusIndustries: ['消费电子'],
  riskSensitivity: 'medium',
  watchRegions: ['亚太'],
  minConfidence: 70,
  notifyByEmail: true,
  trackSupplyStages: ['生产制造', '港口码头'],
};

export const PersonalCenter: React.FC = () => {
  const currentUser = getCurrentUser();
  const [tab, setTab] = useState<'profile' | 'portrait'>('portrait');
  const [config, setConfig] = useState<ProductProfileConfig>(defaultConfig);
  const [portraitRows, setPortraitRows] = useState<PortraitRow[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [versions, setVersions] = useState<PortraitVersion[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [industryOptions, setIndustryOptions] = useState<string[]>(defaultIndustryOptions);
  const [productOptions, setProductOptions] = useState<string[]>(defaultIndustryOptions);
  const [regionOptions, setRegionOptions] = useState<string[]>(defaultRegionOptions);
  const [supplyStageOptions, setSupplyStageOptions] = useState<string[]>(defaultSupplyStageOptions);
  const [codeValueOptions, setCodeValueOptions] = useState<string[]>([]);
  const [featureKeywordOptions, setFeatureKeywordOptions] = useState<string[]>([]);
  const [codingSystemOptions, setCodingSystemOptions] = useState<Array<'HS' | 'GPC' | 'CUSTOM'>>(['HS', 'GPC', 'CUSTOM']);
  const [draftRow, setDraftRow] = useState({
    productLine: '',
    codingSystem: 'HS' as 'HS' | 'GPC' | 'CUSTOM',
    codeValue: '',
    keywordsText: '',
    focusRegions: [] as string[],
    focusStages: [] as string[],
  });

  useEffect(() => {
    let cancelled = false;

    const loadPortraitData = async () => {
      try {
        setIsSyncing(true);
        const [payload, optionPayload] = await Promise.all([
          fetchProductPortrait(),
          fetchProductPortraitOptions(),
        ]);
        if (cancelled) {
          return;
        }

        setConfig({ ...defaultConfig, ...payload.config });
        setPortraitRows(payload.rows || []);
        setVersions(payload.versions || []);
        setIndustryOptions(optionPayload.industryOptions?.length ? optionPayload.industryOptions : defaultIndustryOptions);
        setProductOptions(optionPayload.productOptions?.length ? optionPayload.productOptions : optionPayload.industryOptions?.length ? optionPayload.industryOptions : defaultIndustryOptions);
        setRegionOptions(optionPayload.regionOptions?.length ? optionPayload.regionOptions : defaultRegionOptions);
        setSupplyStageOptions(optionPayload.supplyStageOptions?.length ? optionPayload.supplyStageOptions : defaultSupplyStageOptions);
        setCodeValueOptions(optionPayload.codeValueOptions || []);
        setFeatureKeywordOptions(optionPayload.featureKeywordOptions || []);
        setCodingSystemOptions(optionPayload.codingSystemOptions?.length ? optionPayload.codingSystemOptions : ['HS', 'GPC', 'CUSTOM']);
      } catch {
        if (!cancelled) {
          notifyAction('画像配置读取失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    loadPortraitData();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMultiValue = (
    key: 'focusIndustries' | 'watchRegions' | 'trackSupplyStages',
    value: string,
    checked: boolean
  ) => {
    setConfig((prev) => {
      const values = checked
        ? Array.from(new Set([...prev[key], value]))
        : prev[key].filter((item) => item !== value);
      return { ...prev, [key]: values };
    });
  };

  const parseTextList = (value: string) => {
    return Array.from(
      new Set(
        value
          .split(/[|,，/]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  };

  const toggleDraftSelection = (key: 'focusRegions' | 'focusStages', value: string, checked: boolean) => {
    setDraftRow((prev) => ({
      ...prev,
      [key]: checked
        ? Array.from(new Set([...(prev[key] || []), value]))
        : (prev[key] || []).filter((item) => item !== value),
    }));
  };

  const addPortraitRow = async () => {
    const productLine = draftRow.productLine.trim();
    const codeValue = draftRow.codeValue.trim();

    if (!productLine || !codeValue) {
      notifyAction('请先选择产品并填写编码值');
      return;
    }

    const nextRow: PortraitRow = {
      productLine,
      codingSystem: draftRow.codingSystem,
      codeValue,
      keywords: parseTextList(draftRow.keywordsText),
      focusRegions: draftRow.focusRegions,
      focusStages: draftRow.focusStages,
    };

    const duplicated = portraitRows.some(
      (row) => row.productLine === nextRow.productLine && row.codingSystem === nextRow.codingSystem && row.codeValue === nextRow.codeValue
    );
    if (duplicated) {
      notifyAction('该产品编码组合已存在');
      return;
    }

    const nextRows = [...portraitRows, nextRow];
    try {
      setIsSyncing(true);
      await savePortraitRows(nextRows);
      setDraftRow({
        productLine: '',
        codingSystem: codingSystemOptions[0] || 'HS',
        codeValue: '',
        keywordsText: '',
        focusRegions: [],
        focusStages: [],
      });
      notifyAction('画像行已添加并保存');
    } catch {
      notifyAction('画像行保存失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  const removePortraitRow = async (index: number) => {
    const nextRows = portraitRows.filter((_, i) => i !== index);
    try {
      setIsSyncing(true);
      await savePortraitRows(nextRows);
      notifyAction('画像行已删除');
    } catch {
      notifyAction('删除失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  const saveConfig = async () => {
    try {
      setIsSyncing(true);
      const savedPayload = await saveProductPortraitConfig(config);
      setConfig(savedPayload.config);
      if (savedPayload.versions) {
        setVersions(savedPayload.versions);
      }
      notifyAction('产品画像配置已保存');
    } catch (error: any) {
      notifyAction(`保存失败：${error?.message || '请稍后重试'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const resetConfig = async () => {
    try {
      setIsSyncing(true);
      const savedConfig = await saveProductPortraitConfig(defaultConfig);
      setConfig(savedConfig);
      notifyAction('产品画像配置已重置为默认');
    } catch {
      notifyAction('重置失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadTemplate = () => {
    downloadCsvFile(
      'product-portrait-template.csv',
      ['product_line', 'coding_system', 'code_value', 'keywords', 'focus_regions', 'focus_stages'],
      [
        ['消费电子', 'HS', '8542.31', '芯片|半导体', '亚太|欧洲', '生产制造|港口码头'],
        ['新能源', 'GPC', '12345678', '电池|锂矿', '亚太|北美', '生产制造|仓储配送'],
      ]
    );
    notifyAction('已下载产品画像模板');
  };

  const savePortraitRows = async (rows: PortraitRow[]) => {
    const payload = await persistProductPortraitRows(rows);
    setPortraitRows(payload.rows || []);
    setVersions(payload.versions || []);
  };

  const importFromText = async (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      setImportErrors([{ line: 1, message: '文件内容为空或只有表头' }]);
      return;
    }

    const rows: PortraitRow[] = [];
    const errors: ImportError[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i += 1) {
      const lineNumber = i + 1;
      const cols = lines[i].split(',').map((cell) => cell.trim());
      const [productLine, codingSystemRaw, codeValue, keywordsRaw, regionsRaw, stagesRaw] = cols;

      if (!productLine || !codingSystemRaw || !codeValue) {
        errors.push({ line: lineNumber, message: '缺少必填字段（product_line/coding_system/code_value）' });
        continue;
      }

      const codingSystem = codingSystemRaw.toUpperCase();
      if (!['HS', 'GPC', 'CUSTOM'].includes(codingSystem)) {
        errors.push({ line: lineNumber, message: `编码体系不合法: ${codingSystemRaw}` });
        continue;
      }

      const dedupeKey = `${productLine}__${codingSystem}__${codeValue}`;
      if (seen.has(dedupeKey)) {
        errors.push({ line: lineNumber, message: '重复行（产品线+编码体系+编码值）' });
        continue;
      }
      seen.add(dedupeKey);

      const parsedRow: PortraitRow = {
        productLine,
        codingSystem: codingSystem as PortraitRow['codingSystem'],
        codeValue,
        keywords: (keywordsRaw || '').split('|').map((v) => v.trim()).filter(Boolean),
        focusRegions: (regionsRaw || '').split('|').map((v) => v.trim()).filter(Boolean),
        focusStages: (stagesRaw || '').split('|').map((v) => v.trim()).filter(Boolean),
      };

      rows.push(parsedRow);
    }

    setImportErrors(errors);

    if (rows.length > 0) {
      try {
        setIsSyncing(true);
        await savePortraitRows(rows);
      } catch {
        notifyAction('导入数据保存失败，请稍后重试');
      } finally {
        setIsSyncing(false);
      }

      const recommendedRegions = Array.from(
        new Set(rows.flatMap((row) => row.focusRegions).filter((item) => regionOptions.includes(item)))
      );
      const recommendedStages = Array.from(
        new Set(rows.flatMap((row) => row.focusStages).filter((item) => supplyStageOptions.includes(item)))
      );
      const recommendedKeywords = rows.flatMap((row) => row.keywords).slice(0, 10);

      setConfig((prev) => ({
        ...prev,
        focusIndustries: Array.from(new Set([...prev.focusIndustries, ...rows.map((row) => row.productLine)])),
        watchRegions: recommendedRegions.length > 0 ? recommendedRegions : prev.watchRegions,
        trackSupplyStages: recommendedStages.length > 0 ? recommendedStages : prev.trackSupplyStages,
      }));

      notifyAction(`导入完成：成功 ${rows.length} 行，失败 ${errors.length} 行`);
      if (recommendedKeywords.length > 0) {
        notifyAction(`范围推荐已生成，关键词示例：${recommendedKeywords.slice(0, 3).join(' / ')}`);
      }
    } else {
      notifyAction(`导入失败：共 ${errors.length} 个错误`);
    }
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    await importFromText(text);
  };

  const rollbackVersion = async (versionId: string) => {
    const version = versions.find((item) => item.id === versionId);
    if (!version) {
      return;
    }

    try {
      setIsSyncing(true);
      const payload = await rollbackProductPortraitVersion(versionId);
      setPortraitRows(payload.rows || []);
      setVersions(payload.versions || []);
      notifyAction(`已回滚到 ${new Date(version.createdAt).toLocaleString()} 的版本`);
    } catch {
      notifyAction('版本回滚失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">个人中心</h1>
        <p className="text-[#c1c6d7]">管理个人资料与产品画像配置。</p>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setTab('portrait')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'portrait' ? 'bg-[#adc6ff]/20 text-[#adc6ff] border border-[#adc6ff]/30' : 'bg-[#131b2e] text-[#8b90a0] border border-[#414755]/30'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 inline mr-2" />
          产品画像配置
        </button>
        <button
          onClick={() => setTab('profile')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'profile' ? 'bg-[#adc6ff]/20 text-[#adc6ff] border border-[#adc6ff]/30' : 'bg-[#131b2e] text-[#8b90a0] border border-[#414755]/30'
          }`}
        >
          <User className="w-4 h-4 inline mr-2" />
          个人资料
        </button>
      </div>

      {tab === 'profile' && (
        <section className="bg-[#131b2e] border border-[#414755]/20 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">个人资料</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <InfoItem label="用户名" value={currentUser?.username || '-'} />
            <InfoItem label="姓名" value={currentUser?.fullName || '-'} />
            <InfoItem label="邮箱" value={currentUser?.email || '-'} />
            <InfoItem
              label="角色"
              value={currentUser?.permissions?.map((item) => item.name).join(', ') || '普通用户'}
            />
          </div>
        </section>
      )}

      {tab === 'portrait' && (
        <section className="bg-[#131b2e] border border-[#414755]/20 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">产品画像配置</h2>
            <button
              onClick={saveConfig}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-[#adc6ff] text-[#001a41] font-bold text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              保存画像配置
            </button>
          </div>

          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#dae2fd]">产品画像导入（CSV）</h3>
                <p className="text-xs text-[#8b90a0]">支持字段：产品线、编码体系、编码值、关键词、关注地区、关注环节</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-3 py-2 rounded-lg bg-[#2d3449] text-[#adc6ff] text-xs font-bold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
            </div>
            <label className="flex items-center gap-2 w-fit px-3 py-2 rounded-lg bg-[#adc6ff]/20 text-[#adc6ff] text-xs font-bold cursor-pointer">
              <Upload className="w-4 h-4" />
              选择文件并导入
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
              />
            </label>
            {importErrors.length > 0 && (
              <div className="rounded-lg border border-[#ff5545]/30 bg-[#ff5545]/10 p-3">
                <p className="text-xs font-bold text-[#ffb3ab] mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  导入校验问题（前5条）
                </p>
                <ul className="text-xs text-[#ffd7d2] space-y-1">
                  {importErrors.slice(0, 5).map((item) => (
                    <li key={`${item.line}-${item.message}`}>第 {item.line} 行：{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#dae2fd]">手动新增画像行</h3>
              <span className="text-xs text-[#8b90a0]">产品 + 特征 + 编码</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-[#8b90a0] block mb-1">产品</label>
                <select
                  value={draftRow.productLine}
                  onChange={(event) => setDraftRow((prev) => ({ ...prev, productLine: event.target.value }))}
                  className="w-full bg-[#131b2e] border border-[#414755]/30 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">选择产品</option>
                  {productOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#8b90a0] block mb-1">编码体系</label>
                <select
                  value={draftRow.codingSystem}
                  onChange={(event) => setDraftRow((prev) => ({ ...prev, codingSystem: event.target.value as PortraitRow['codingSystem'] }))}
                  className="w-full bg-[#131b2e] border border-[#414755]/30 rounded-lg px-3 py-2 text-sm"
                >
                  {codingSystemOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#8b90a0] block mb-1">编码值</label>
                <input
                  list="portrait-code-options"
                  value={draftRow.codeValue}
                  onChange={(event) => setDraftRow((prev) => ({ ...prev, codeValue: event.target.value }))}
                  placeholder="选择或输入编码"
                  className="w-full bg-[#131b2e] border border-[#414755]/30 rounded-lg px-3 py-2 text-sm"
                />
                <datalist id="portrait-code-options">
                  {codeValueOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[11px] text-[#8b90a0] block mb-1">产品特征关键词（支持 | 或 , 分隔）</label>
              <input
                value={draftRow.keywordsText}
                onChange={(event) => setDraftRow((prev) => ({ ...prev, keywordsText: event.target.value }))}
                placeholder={featureKeywordOptions.length > 0 ? `例如: ${featureKeywordOptions.slice(0, 3).join(' | ')}` : '例如: 芯片|冷链|港口拥堵'}
                className="w-full bg-[#131b2e] border border-[#414755]/30 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-[11px] text-[#8b90a0] mb-2">关联地区</p>
                <div className="grid grid-cols-2 gap-2">
                  {regionOptions.slice(0, 8).map((item) => (
                    <label key={`draft-region-${item}`} className="text-xs flex items-center gap-2 rounded border border-[#414755]/20 px-2 py-1.5 bg-[#131b2e]">
                      <input
                        type="checkbox"
                        checked={draftRow.focusRegions.includes(item)}
                        onChange={(event) => toggleDraftSelection('focusRegions', item, event.target.checked)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#8b90a0] mb-2">关联环节</p>
                <div className="grid grid-cols-2 gap-2">
                  {supplyStageOptions.slice(0, 8).map((item) => (
                    <label key={`draft-stage-${item}`} className="text-xs flex items-center gap-2 rounded border border-[#414755]/20 px-2 py-1.5 bg-[#131b2e]">
                      <input
                        type="checkbox"
                        checked={draftRow.focusStages.includes(item)}
                        onChange={(event) => toggleDraftSelection('focusStages', item, event.target.checked)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={addPortraitRow}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-[#adc6ff] text-[#001a41] font-bold text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              添加并保存画像行
            </button>
          </div>

          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#dae2fd]">画像数据概览</h3>
              <span className="text-xs text-[#8b90a0]">当前有效记录: {portraitRows.length}</span>
            </div>
            {portraitRows.length === 0 ? (
              <p className="text-xs text-[#8b90a0]">尚未导入画像，建议先下载模板并导入。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#8b90a0]">
                      <th className="text-left py-2">产品线</th>
                      <th className="text-left py-2">编码体系</th>
                      <th className="text-left py-2">编码值</th>
                      <th className="text-left py-2">产品特征</th>
                      <th className="text-left py-2">关注地区</th>
                      <th className="text-left py-2">关注环节</th>
                      <th className="text-left py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portraitRows.slice(0, 8).map((row, index) => (
                      <tr key={`${row.productLine}-${row.codeValue}-${index}`} className="border-t border-[#414755]/20 text-[#c1c6d7]">
                        <td className="py-2">{row.productLine}</td>
                        <td className="py-2">{row.codingSystem}</td>
                        <td className="py-2">{row.codeValue}</td>
                        <td className="py-2">{row.keywords.join(' / ') || '-'}</td>
                        <td className="py-2">{row.focusRegions.join(' / ') || '-'}</td>
                        <td className="py-2">{row.focusStages.join(' / ') || '-'}</td>
                        <td className="py-2">
                          <button
                            onClick={() => removePortraitRow(index)}
                            className="px-2 py-1 rounded bg-[#ff5545]/15 text-[#ffb3ab] text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <ConfigGroup title="关注行业">
            <CheckGrid
              options={industryOptions}
              selected={config.focusIndustries}
              onToggle={(value, checked) => toggleMultiValue('focusIndustries', value, checked)}
            />
          </ConfigGroup>

          <ConfigGroup title="重点区域">
            <CheckGrid
              options={regionOptions}
              selected={config.watchRegions}
              onToggle={(value, checked) => toggleMultiValue('watchRegions', value, checked)}
            />
          </ConfigGroup>

          <ConfigGroup title="追踪供应链环节">
            <CheckGrid
              options={supplyStageOptions}
              selected={config.trackSupplyStages}
              onToggle={(value, checked) => toggleMultiValue('trackSupplyStages', value, checked)}
            />
          </ConfigGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-[#c1c6d7] mb-2">风险敏感度</label>
              <select
                value={config.riskSensitivity}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    riskSensitivity: event.target.value as ProductProfileConfig['riskSensitivity'],
                  }))
                }
                className="w-full bg-[#0b1326] border border-[#414755]/30 rounded-lg px-3 py-2 text-sm"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#c1c6d7] mb-2">最低置信度阈值: {config.minConfidence}%</label>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={config.minConfidence}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, minConfidence: Number(event.target.value) }))
                }
                className="w-full"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-[#414755]/30 px-4 py-3 text-sm">
            邮件接收预警通知
            <input
              type="checkbox"
              checked={config.notifyByEmail}
              onChange={(event) => setConfig((prev) => ({ ...prev, notifyByEmail: event.target.checked }))}
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={saveConfig}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-[#adc6ff] text-[#001a41] font-bold text-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存画像配置
            </button>
            <button
              onClick={resetConfig}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-[#2d3449] text-[#dae2fd] font-bold text-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              恢复默认
            </button>
          </div>

          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <h3 className="text-sm font-bold text-[#dae2fd] mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-[#adc6ff]" />
              画像版本管理
            </h3>
            {versions.length === 0 ? (
              <p className="text-xs text-[#8b90a0]">暂无历史版本，导入画像后会自动生成版本。</p>
            ) : (
              <div className="space-y-2">
                {versions.slice(0, 6).map((version) => (
                  <div key={version.id} className="flex items-center justify-between border border-[#414755]/20 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs text-[#dae2fd] font-bold">{new Date(version.createdAt).toLocaleString()}</p>
                      <p className="text-[11px] text-[#8b90a0]">
                        {version.actionType === 'config_update' ? '配置更新' : version.actionType === 'rollback' ? '版本回滚' : '画像行更新'}
                        {' · '}
                        {version.rowCount} 条画像记录
                      </p>
                      {version.configSnapshot && (
                        <p className="text-[11px] text-[#8b90a0] mt-1">
                          配置快照: 敏感度 {version.configSnapshot.riskSensitivity} / 置信度 {version.configSnapshot.minConfidence}% /
                          行业 {version.configSnapshot.focusIndustries.length} 项
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => rollbackVersion(version.id)}
                      className="px-3 py-1.5 rounded bg-[#2d3449] text-[#adc6ff] text-xs font-bold"
                    >
                      回滚
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg p-4">
            <h3 className="text-sm font-bold text-[#dae2fd] mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#adc6ff]" />
              范围推荐（基于导入画像）
            </h3>
            <p className="text-xs text-[#8b90a0] mb-3">系统已根据导入数据推荐关注范围，你可以直接确认或调整。</p>
            <div className="text-xs text-[#c1c6d7] space-y-1">
              <p>推荐行业：{Array.from(new Set(portraitRows.map((row) => row.productLine))).slice(0, 6).join(' / ') || '-'}</p>
              <p>推荐地区：{Array.from(new Set(portraitRows.flatMap((row) => row.focusRegions))).slice(0, 6).join(' / ') || '-'}</p>
              <p>推荐环节：{Array.from(new Set(portraitRows.flatMap((row) => row.focusStages))).slice(0, 6).join(' / ') || '-'}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#0b1326] border border-[#414755]/20 rounded-lg px-4 py-3">
    <p className="text-[11px] text-[#8b90a0] uppercase tracking-wider mb-1">{label}</p>
    <p className="font-bold text-[#dae2fd]">{value}</p>
  </div>
);

const ConfigGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-sm font-bold text-[#c1c6d7] mb-3">{title}</h3>
    {children}
  </div>
);

const CheckGrid = ({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
    {options.map((option) => (
      <label key={option} className="flex items-center gap-2 rounded-lg border border-[#414755]/20 px-3 py-2 bg-[#0b1326] text-sm">
        <input
          type="checkbox"
          checked={selected.includes(option)}
          onChange={(event) => onToggle(option, event.target.checked)}
        />
        <span>{option}</span>
      </label>
    ))}
  </div>
);

export default PersonalCenter;
