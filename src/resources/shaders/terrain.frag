#include <versionPrecision>
#include <gBufferOut>

in vec4 vNormalUV;
in vec2 vDetailUV;
in vec2 vWaterUV;
in vec2 vMaskUV;
in vec3 vNormal;
in vec3 vPosition;
in vec4 vClipPos;
in vec4 vClipPosPrev;
in vec3 vCenter;
in vec3 vBiomeColor;
in float vMixFactor;

uniform PerMesh {
    mat4 modelViewMatrix;
    mat4 modelViewMatrixPrev;
    vec4 transformNormal0;
    vec4 transformNormal1;
    vec4 transformWater0;
    vec4 transformWater1;
    vec3 transformMask;
    float size;
    float segmentCount;
    vec2 detailTextureOffset;
    int levelId;
    vec2 cameraPosition;
};

uniform PerMaterial {
    mat4 projectionMatrix;
    vec2 biomeCoordinates;
    float time;
};

uniform sampler2DArray tNormal;
uniform sampler2DArray tWater;
uniform sampler2D tWaterMask;
uniform sampler2D tDetailColor;
uniform sampler2D tDetailNormal;
uniform sampler2D tDetailNoise;
uniform sampler2D tWaterNormal;

#include <packNormal>
#include <getMotionVector>
#include <sampleCatmullRom>
#include <getTBN>
#include <textureNoTile>

vec3 sampleNormalMap() {
    vec2 size = vec2(textureSize(tNormal, 0));
    vec3 level0 = sampleCatmullRom(tNormal, vec3(vNormalUV.xy, 0), size).xyz;
    vec3 level1 = sampleCatmullRom(tNormal, vec3(vNormalUV.zw, 1), size).xyz;
    float factor = smoothstep(NORMAL_MIX_FROM, NORMAL_MIX_TO, vMixFactor);

    return mix(level0, level1, factor);
}

vec3 getNormal(vec3 normalTextureValue) {
    vec3 heightMapNormal = sampleNormalMap();
    vec3 kindaVNormal = normalize(vec3(modelViewMatrix * vec4(heightMapNormal, 0)));

    mat3 tbn = getTBN(kindaVNormal, vPosition, vDetailUV);
    vec3 mapValue = normalTextureValue * 2. - 1.;
    mapValue.x *= 0.2;
    mapValue.y *= 0.2;
    vec3 normal = normalize(tbn * normalize(mapValue));

    normal *= float(gl_FrontFacing) * 2. - 1.;

    return kindaVNormal;
}

float edgeFactor() {
    float widthFactor = 1.;
    vec3 d = fwidth(vCenter.xyz);
    vec3 a3 = smoothstep(vec3(0), d * widthFactor, vCenter.xyz);

    return min(min(a3.x, a3.y), a3.z);
}

vec3 getWaterNormalMapValue(vec2 uv) {
    vec3 col = texture(tWaterNormal, uv).rgb;
    col.y = 1. - col.y;
    return col * 2. - 1.;
}

void main() {
    if (edgeFactor() > 0.9) {
        //discard;
    }

    float waterMask = 1.;

    if (vMaskUV.x >= 0. && vMaskUV.x <= 1. && vMaskUV.y >= 0. && vMaskUV.y <= 1.) {
        //waterMask = 1. - texture(tWaterMask, vMaskUV).r;
    }

    vec3 detailNormal = getNormal(textureNoTile(tDetailNoise, tDetailNormal, vDetailUV, 0.01));
    vec3 detailColor = textureNoTile(tDetailNoise, tDetailColor, vDetailUV, 0.01) * vBiomeColor;

    vec3 waterUV = vec3(0);
    waterUV.xy = transformWater0.xy + vWaterUV * transformWater0.zw;

    if (vMixFactor > 7300.) {
        waterUV.xy = transformWater1.xy + vWaterUV * transformWater1.zw;
        waterUV.z = 1.;
    }

    float waterSample = texture(tWater, waterUV).r;
    float waterFactor = waterSample * waterMask;

    outColor = vec4(detailColor, 1);
    outNormal = packNormal(detailNormal);
    outRoughnessMetalnessF0 = vec3(0.9, 0, 0.001);

    if (waterFactor > 0.5) {
        float waveTime = time * 0.015;
        vec3 normalValue = (
            getWaterNormalMapValue(vDetailUV * 0.005 + waveTime) * 0.45 +
            getWaterNormalMapValue(vDetailUV * 0.020 - waveTime) * 0.45 +
            getWaterNormalMapValue(vDetailUV * 0.0005 - waveTime * 0.5) * 0.1
        );

        normalValue.z *= 2.;
        outColor = vec4(0.1, 0.2, 0.3, 0.5);

        vec3 vNormal = vec3(modelViewMatrix * vec4(normalize(normalValue.xzy), 0));
        outNormal = packNormal(vNormal);
        outRoughnessMetalnessF0 = vec3(0.05, 0, 0.03);
    }

    outMotion = getMotionVector(vClipPos, vClipPosPrev);
    outObjectId = 0u;
}